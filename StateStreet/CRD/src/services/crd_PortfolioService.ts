import assert from 'assert';
import { joinUrls } from './joinUrls';
import {
    fetchWireMockMappings,
    RegisteredWireMockMapping,
    removeWireMockMapping,
    resetWireMockMappings,
    upsertWireMockMapping,
    updateWireMockMapping,
    WireMockAdminConfig,
    WireMockMapping,
} from './wiremockService';

export type CrdPortfolioServiceConfig = WireMockAdminConfig & {
    crd_portfolioService: {
        url: string;
    };
};

export type Security = {
    security: string;
    current_value: number;
    target_percentage: number;
    current_percentage: number;
    target_variance: number;
    unit_price: number;
};

export type Portfolio = {
    account: string;
    total_asset: number;
    vested?: number;
    cash_percentage?: number;
    stocks_percentage?: number;
    securities: Security[];
};

export type PortfolioAsset = {
    total_asset: number;
    vested?: number;
    cash_percentage: number;
    stocks_percentage: number;
};

export type PortfolioAccounts = {
    accounts: string[];
};

export type SecurityTrade = {
    security: string;
    action: string;
    shares: number;
    unit_price: number;
};

const cashSecurity = 'CRD_CASH';

export class CrdPortfolioService {
    constructor(private readonly config: CrdPortfolioServiceConfig) {}

    get api() {
        return {
            accounts: {
                list: {
                    path: this.apiPath('accounts'),
                    url: this.apiUrl('accounts'),
                },
                account: (accountId: string) => ({
                    path: this.apiPath(`accounts/${accountId}`),
                    url: this.apiUrl(`accounts/${accountId}`),
                }),
            },
        };
    }

    createPortfolio(accountId: string, asset: PortfolioAsset): Portfolio {
        return {
            account: accountId.toUpperCase(),
            ...asset,
            securities: [],
        };
    }

    mergePortfolioSecurities(portfolio: Portfolio, securities: Security[]): Portfolio {
        const mergedPortfolio = { ...portfolio, securities };
        this.validateSecurityAllocations(mergedPortfolio);

        return this.withDerivedAssetMetadata(mergedPortfolio);
    }

    async fetchPortfolio(accountId: string): Promise<Portfolio> {
        const response = await fetch(this.api.accounts.account(accountId).url);

        if (!response.ok) {
            throw new Error(`Failed to fetch mock account data. Status: ${response.status} ${response.statusText}`);
        }

        const portfolio = await response.json();
        if (!isPortfolio(portfolio)) {
            throw new Error(`Portfolio account ${accountId} response payload is invalid`);
        }

        return portfolio;
    }

    async fetchPortfolioAccounts(): Promise<PortfolioAccounts> {
        const response = await fetch(this.api.accounts.list.url);

        if (!response.ok) {
            throw new Error(`Failed to fetch mock portfolio accounts. Status: ${response.status} ${response.statusText}`);
        }

        const portfolioAccounts = await response.json();
        if (!isPortfolioAccounts(portfolioAccounts)) {
            throw new Error('Portfolio accounts response payload is invalid');
        }

        return portfolioAccounts;
    }

    async hasPortfolio(accountId: string): Promise<boolean> {
        const response = await fetch(this.api.accounts.account(accountId).url);

        if (response.status === 404) {
            return false;
        }

        if (!response.ok) {
            throw new Error(`Failed to check mock account data. Status: ${response.status} ${response.statusText}`);
        }

        return true;
    }

    async registerDynamicPortfolio(accountId: string, portfolio: Portfolio): Promise<string> {
        const mappingId = await upsertWireMockMapping(this.config, this.portfolioMapping(accountId, portfolio));
        await this.registerPortfolioAccount(accountId);

        return mappingId;
    }

    async clearPortfolioAccounts(): Promise<void> {
        const mappings = await fetchWireMockMappings(this.config);
        // Clearing the collection also removes static and dynamic individual portfolio mappings.
        const portfolioAccountMappings = mappings.filter((mapping) => this.isPortfolioAccountMapping(mapping));

        await Promise.all(portfolioAccountMappings.map((mapping) => {
            assert(mapping.id, 'Portfolio account WireMock mapping ID is missing');
            return removeWireMockMapping(this.config, mapping.id);
        }));

        await upsertWireMockMapping(this.config, this.portfolioAccountsMapping({ accounts: [] }));
    }

    async removePortfolioAccount(accountId: string): Promise<void> {
        const portfolioAccounts = await this.fetchPortfolioAccounts();
        const accounts = portfolioAccounts.accounts.filter((account) => account !== accountId.toUpperCase());
        await upsertWireMockMapping(this.config, this.portfolioAccountsMapping({ accounts }));
    }

    async resetPortfolioAccountSystem(): Promise<void> {
        // Restores static file-backed mappings, including the default ABC account and portfolio.
        await resetWireMockMappings(this.config);
    }

    async updateDynamicPortfolio(accountId: string, mappingId: string, portfolio: Portfolio): Promise<void> {
        await updateWireMockMapping(this.config, mappingId, this.portfolioMapping(accountId, portfolio));
    }

    deriveAssetAllocationMetadata(portfolio: Portfolio): PortfolioAsset {
        const totalAsset = this.totalAssetFrom(portfolio);
        const securitiesValue = sum(portfolio.securities.map(this.securityValue));
        const cashValue = this.cashValue(portfolio.securities);
        assertApproximatelyEqual(securitiesValue, totalAsset, 'securities total');

        return {
            total_asset: totalAsset,
            vested: portfolio.vested,
            cash_percentage: totalAsset === 0 ? 0 : round((cashValue / totalAsset) * 100),
            stocks_percentage: totalAsset === 0 ? 0 : round(((totalAsset - cashValue) / totalAsset) * 100),
        };
    }

    hasCompleteAssetMetadata(portfolio: Portfolio): boolean {
        return typeof portfolio.total_asset === 'number'
            && typeof portfolio.vested === 'number'
            && typeof portfolio.cash_percentage === 'number'
            && typeof portfolio.stocks_percentage === 'number';
    }

    validatePortfolioAssetMetadata(portfolio: Portfolio): PortfolioAsset {
        this.validateSecurityAllocations(portfolio);
        const derivedAssetMetadata = this.deriveAssetAllocationMetadata(portfolio);

        if (this.hasCompleteAssetMetadata(portfolio)) {
            assertApproximatelyEqual(portfolio.total_asset, derivedAssetMetadata.total_asset, 'total_asset');
            assertApproximatelyEqual(portfolio.cash_percentage, derivedAssetMetadata.cash_percentage, 'cash_percentage');
            assertApproximatelyEqual(portfolio.stocks_percentage, derivedAssetMetadata.stocks_percentage, 'stocks_percentage');
        }

        return derivedAssetMetadata;
    }

    balancePortfolio(portfolio: Portfolio): { portfolio: Portfolio; trades: SecurityTrade[] } {
        const sourcePortfolio = this.withDerivedAssetMetadata(portfolio);
        const totalAsset = sourcePortfolio.total_asset;
        let cashValue = this.cashValue(sourcePortfolio.securities);
        const trades: SecurityTrade[] = [];

        const securities = sourcePortfolio.securities
            .filter((security) => security.security !== cashSecurity)
            .map((security) => {
                const targetValue = (security.target_percentage / 100) * totalAsset;
                const currentValue = this.securityValue(security);
                const valueDifference = targetValue - currentValue;
                const shares = Math.trunc(Math.abs(valueDifference) / security.unit_price);
                const action = valueDifference > 0 ? 'Buy' : valueDifference < 0 ? 'Sell' : 'No trade';
                const signedShares = action === 'Buy' ? shares : action === 'Sell' ? -shares : 0;

                cashValue -= signedShares * security.unit_price;
                trades.push({ security: security.security, action, shares, unit_price: security.unit_price });

                return {
                    ...security,
                    current_value: currentValue + signedShares * security.unit_price,
                };
            });

        assert(cashValue >= 0, `Portfolio rebalance requires ${Math.abs(cashValue)} additional cash`);

        if (cashValue > 0) {
            securities.push({
                security: cashSecurity,
                current_value: round(cashValue),
                target_percentage: 0,
                current_percentage: 0,
                target_variance: 0,
                unit_price: 1,
            });
        }

        return {
            portfolio: this.withBalancedSecurities({
                account: sourcePortfolio.account,
                total_asset: totalAsset,
                vested: sourcePortfolio.vested,
                securities,
            }),
            trades,
        };
    }

    private withDerivedAssetMetadata(portfolio: Portfolio): Portfolio {
        const assetMetadata = this.deriveAssetAllocationMetadata(portfolio);

        return {
            account: portfolio.account,
            vested: portfolio.vested,
            ...assetMetadata,
            securities: portfolio.securities,
        };
    }

    private withBalancedSecurities(portfolio: Portfolio): Portfolio {
        const portfolioWithMetadata = this.withDerivedAssetMetadata(portfolio);

        return {
            ...portfolioWithMetadata,
            securities: portfolio.securities.map((security) => {
                const currentPercentage = portfolioWithMetadata.total_asset === 0
                    ? 0
                    : round((this.securityValue(security) / portfolioWithMetadata.total_asset) * 100);

                return {
                    ...security,
                    current_value: this.securityValue(security),
                    current_percentage: currentPercentage,
                    target_variance: round(currentPercentage - security.target_percentage),
                };
            }),
        };
    }

    private cashValue(securities: Security[]): number {
        return sum(
            securities
                .filter((security) => security.security === cashSecurity)
                .map(this.securityValue),
        );
    }

    private securityValue(security: Security): number {
        return security.current_value;
    }

    private totalAssetFrom(portfolio: Portfolio): number {
        assert(typeof portfolio.total_asset === 'number', 'Portfolio total_asset is missing');
        return portfolio.total_asset;
    }

    private validateSecurityAllocations(portfolio: Portfolio): void {
        const totalAsset = this.totalAssetFrom(portfolio);
        portfolio.securities.forEach((security) => {
            const expectedCurrentValue = totalAsset * (security.current_percentage / 100);
            assertApproximatelyEqual(security.current_value, expectedCurrentValue, `${security.security} current_value`);
            assertApproximatelyEqual(
                security.target_variance,
                security.current_percentage - security.target_percentage,
                `${security.security} target_variance`,
            );
        });
    }

    private portfolioMapping(accountId: string, portfolio: Portfolio): WireMockMapping {
        return {
            metadata: {
                mappingKey: `crd_portfolioService:portfolio-account:${accountId}`,
                owner: 'crd-portfolio-qa',
                service: 'crd_portfolioService',
                resource: 'portfolio-account',
                accountId,
            },
            priority: 10,
            request: {
                method: 'GET',
                urlPath: this.api.accounts.account(accountId).path,
            },
            response: {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                jsonBody: portfolio,
            },
        };
    }

    async registerPortfolioAccount(accountId: string): Promise<void> {
        // The account-name collection is independent from individual portfolio mappings.
        const portfolioAccounts = await this.fetchPortfolioAccounts();
        const accounts = [...new Set([...portfolioAccounts.accounts, accountId.toUpperCase()])].sort();

        await upsertWireMockMapping(this.config, this.portfolioAccountsMapping({ accounts }));
    }

    private portfolioAccountsMapping(portfolioAccounts: PortfolioAccounts): WireMockMapping {
        return {
            metadata: {
                mappingKey: 'crd_portfolioService:portfolio-accounts',
                owner: 'crd-portfolio-qa',
                service: 'crd_portfolioService',
                resource: 'portfolio-accounts',
            },
            priority: 10,
            request: {
                method: 'GET',
                urlPathPattern: `${this.api.accounts.list.path}/?`,
            },
            response: {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                jsonBody: portfolioAccounts,
            },
        };
    }

    private isPortfolioAccountMapping(mapping: RegisteredWireMockMapping): boolean {
        const accountsPath = this.api.accounts.list.path;
        const requestPath = mapping.request.urlPath
            ?? mapping.request.urlPathPattern
            ?? mapping.request.urlPathTemplate;

        return requestPath === accountsPath
            || requestPath === `${accountsPath}/`
            || requestPath === `${accountsPath}/?`
            || requestPath?.startsWith(`${accountsPath}/`) === true;
    }

    private apiUrl(api: string): string {
        return joinUrls(this.config.crd_portfolioService.url, api);
    }

    private apiPath(api: string): string {
        return new URL(this.apiUrl(api)).pathname;
    }
}

function assertApproximatelyEqual(actual: number | undefined, expected: number, field: string): void {
    assert(typeof actual === 'number', `Portfolio ${field} cache is missing`);
    assert(Math.abs(actual - expected) < 0.0001, `Portfolio ${field} ${actual} does not match expected ${expected}`);
}

function round(value: number): number {
    return Number(value.toFixed(4));
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

function isPortfolio(value: unknown): value is Portfolio {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const portfolio = value as Record<string, unknown>;
    return typeof portfolio.account === 'string'
        && typeof portfolio.total_asset === 'number'
        && optionalNumber(portfolio.vested)
        && optionalNumber(portfolio.cash_percentage)
        && optionalNumber(portfolio.stocks_percentage)
        && Array.isArray(portfolio.securities)
        && portfolio.securities.every(isSecurity);
}

function isPortfolioAccounts(value: unknown): value is PortfolioAccounts {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const portfolioAccounts = value as Record<string, unknown>;
    return Array.isArray(portfolioAccounts.accounts)
        && portfolioAccounts.accounts.every((account) => typeof account === 'string');
}

function optionalNumber(value: unknown): boolean {
    return value === undefined || typeof value === 'number';
}

function isSecurity(value: unknown): value is Security {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const security = value as Record<string, unknown>;
    return typeof security.security === 'string'
        && typeof security.current_value === 'number'
        && typeof security.target_percentage === 'number'
        && typeof security.current_percentage === 'number'
        && typeof security.target_variance === 'number'
        && typeof security.unit_price === 'number';
}
