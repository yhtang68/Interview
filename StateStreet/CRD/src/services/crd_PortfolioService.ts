import assert from 'assert';
import { joinUrls } from './joinUrls';
import {
    CrdPortfolioModel,
    isPortfolio,
    isPortfolioAccounts,
    Portfolio,
    PortfolioAccounts,
    PortfolioAsset,
    Security,
    SecurityTrade,
} from './crd_PortfolioModel';
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

export type { Portfolio, PortfolioAccounts, PortfolioAsset, Security, SecurityTrade } from './crd_PortfolioModel';

export class CrdPortfolioService {
    private readonly model = new CrdPortfolioModel();

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
        return this.model.createPortfolio(accountId, asset);
    }

    mergePortfolioSecurities(portfolio: Portfolio, securities: Security[]): Portfolio {
        return this.model.mergePortfolioSecurities(portfolio, securities);
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

    async registerDynamicPortfolioResponse(accountId: string, status: number, jsonBody: unknown): Promise<string> {
        const mappingId = await upsertWireMockMapping(this.config, this.portfolioResponseMapping(accountId, status, jsonBody));
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

    async removeAccountPortfolio(accountId: string): Promise<void> {
        const mappings = await fetchWireMockMappings(this.config);
        const portfolioMappings = mappings.filter((mapping) => this.isAccountPortfolioMapping(mapping, accountId));

        await Promise.all(portfolioMappings.map((mapping) => {
            assert(mapping.id, 'Account portfolio WireMock mapping ID is missing');
            return removeWireMockMapping(this.config, mapping.id);
        }));
    }

    async resetPortfolioAccountSystem(): Promise<void> {
        // Restores static file-backed mappings, including the default ABC account and portfolio.
        await resetWireMockMappings(this.config);
    }

    async updateDynamicPortfolio(accountId: string, mappingId: string, portfolio: Portfolio): Promise<void> {
        await updateWireMockMapping(this.config, mappingId, this.portfolioMapping(accountId, portfolio));
    }

    deriveAssetAllocationMetadata(portfolio: Portfolio): PortfolioAsset {
        return this.model.deriveAssetAllocationMetadata(portfolio);
    }

    hasCompleteAssetMetadata(portfolio: Portfolio): boolean {
        return this.model.hasCompleteAssetMetadata(portfolio);
    }

    validatePortfolioAssetMetadata(portfolio: Portfolio): PortfolioAsset {
        return this.model.validatePortfolioAssetMetadata(portfolio);
    }

    balancePortfolio(portfolio: Portfolio): { portfolio: Portfolio; trades: SecurityTrade[] } {
        return this.model.balancePortfolio(portfolio);
    }

    private portfolioMapping(accountId: string, portfolio: Portfolio): WireMockMapping {
        return this.portfolioResponseMapping(accountId, 200, portfolio);
    }

    private portfolioResponseMapping(accountId: string, status: number, jsonBody: unknown): WireMockMapping {
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
                status,
                headers: { 'Content-Type': 'application/json' },
                jsonBody,
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

    private isAccountPortfolioMapping(mapping: RegisteredWireMockMapping, accountId: string): boolean {
        return mapping.request.urlPath?.toLowerCase() === this.api.accounts.account(accountId).path.toLowerCase();
    }

    private apiUrl(api: string): string {
        return joinUrls(this.config.crd_portfolioService.url, api);
    }

    private apiPath(api: string): string {
        return new URL(this.apiUrl(api)).pathname;
    }
}
