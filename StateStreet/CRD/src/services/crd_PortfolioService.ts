import assert from 'assert';
import { joinUrls } from './joinUrls';
import {
    createWireMockMapping,
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
    total_asset?: number;
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
                account: (accountId: string) => ({
                    path: this.apiPath(`accounts/${accountId}`),
                    url: this.apiUrl(`accounts/${accountId}`),
                }),
            },
        };
    }

    createPortfolio(accountId: string, securities: Security[]): Portfolio {
        return this.withDerivedData({
            account: accountId.toUpperCase(),
            securities,
        });
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

    async registerDynamicPortfolio(accountId: string, portfolio: Portfolio): Promise<string> {
        return createWireMockMapping(this.config, this.portfolioMapping(accountId, portfolio));
    }

    async updateDynamicPortfolio(accountId: string, mappingId: string, portfolio: Portfolio): Promise<void> {
        await updateWireMockMapping(this.config, mappingId, this.portfolioMapping(accountId, portfolio));
    }

    calculatePortfolioAsset(securities: Security[]): PortfolioAsset {
        const totalAsset = sum(securities.map(this.securityValue));
        const cashValue = this.cashValue(securities);

        return {
            total_asset: round(totalAsset),
            cash_percentage: totalAsset === 0 ? 0 : round((cashValue / totalAsset) * 100),
            stocks_percentage: totalAsset === 0 ? 0 : round(((totalAsset - cashValue) / totalAsset) * 100),
        };
    }

    hasAssetCache(portfolio: Portfolio): boolean {
        return typeof portfolio.total_asset === 'number'
            && typeof portfolio.vested === 'number'
            && typeof portfolio.cash_percentage === 'number'
            && typeof portfolio.stocks_percentage === 'number';
    }

    assertAssetCacheMatches(portfolio: Portfolio): PortfolioAsset {
        const calculatedAsset = this.calculatePortfolioAsset(portfolio.securities);

        if (this.hasAssetCache(portfolio)) {
            assertApproximatelyEqual(portfolio.total_asset, calculatedAsset.total_asset, 'total_asset');
            assertApproximatelyEqual(portfolio.cash_percentage, calculatedAsset.cash_percentage, 'cash_percentage');
            assertApproximatelyEqual(portfolio.stocks_percentage, calculatedAsset.stocks_percentage, 'stocks_percentage');
        }

        return {
            ...calculatedAsset,
            vested: portfolio.vested,
        };
    }

    refreshAssetCache(portfolio: Portfolio, vested = portfolio.vested): Portfolio {
        return this.withDerivedData({ ...portfolio, vested });
    }

    balancePortfolio(portfolio: Portfolio): { portfolio: Portfolio; trades: SecurityTrade[] } {
        const sourcePortfolio = this.withDerivedData(portfolio);
        const totalAsset = sourcePortfolio.total_asset as number;
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
            portfolio: this.withDerivedData({
                account: sourcePortfolio.account,
                vested: sourcePortfolio.vested,
                securities,
            }),
            trades,
        };
    }

    private withDerivedData(portfolio: Portfolio): Portfolio {
        const asset = this.calculatePortfolioAsset(portfolio.securities);

        return {
            account: portfolio.account,
            vested: portfolio.vested,
            ...asset,
            securities: portfolio.securities.map((security) => {
                const currentPercentage = asset.total_asset === 0
                    ? 0
                    : round((this.securityValue(security) / asset.total_asset) * 100);

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

    private portfolioMapping(accountId: string, portfolio: Portfolio): WireMockMapping {
        return {
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

    private apiUrl(api: string): string {
        return joinUrls(this.config.crd_portfolioService.url, api);
    }

    private apiPath(api: string): string {
        return new URL(this.apiUrl(api)).pathname;
    }
}

function assertApproximatelyEqual(actual: number | undefined, expected: number, field: string): void {
    assert(typeof actual === 'number', `Portfolio ${field} cache is missing`);
    assert(Math.abs(actual - expected) < 0.0001, `Portfolio ${field} cache ${actual} does not match calculated ${expected}`);
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
        && optionalNumber(portfolio.total_asset)
        && optionalNumber(portfolio.vested)
        && optionalNumber(portfolio.cash_percentage)
        && optionalNumber(portfolio.stocks_percentage)
        && Array.isArray(portfolio.securities)
        && portfolio.securities.every(isSecurity);
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
