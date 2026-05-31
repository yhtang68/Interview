import { joinUrls } from './joinUrls';
import { createWireMockMapping, WireMockAdminConfig } from './wiremockService';

export type CrdPortfolioServiceConfig = WireMockAdminConfig & {
    crd_portfolioService: {
        url: string;
    };
};

export type Security = {
    security: string;
    target_percentage: number;
    current_percentage: number;
    target_variance: number;
    unit_price: number;
};

export type Portfolio = {
    account: string;
    total_asset: number;
    vested: number;
    securities: Security[];
};

export type SecurityBalance = {
    action: string;
    shares: number;
};

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
        return {
            account: accountId.toUpperCase(),
            total_asset: 100000,
            vested: 1,
            securities,
        };
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
        return createWireMockMapping(this.config, {
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
        });
    }

    calculateBalance(portfolio: Portfolio, security: Security): SecurityBalance {
        if (security.target_variance === 0) {
            return { action: 'No trade', shares: 0 };
        }

        const vestedAssets = portfolio.total_asset * portfolio.vested;
        const tradeValue = Math.abs(security.target_variance / 100) * vestedAssets;
        const shares = Number((tradeValue / security.unit_price).toFixed(4));

        return {
            action: security.target_variance < 0 ? 'Buy' : 'Sell',
            shares,
        };
    }

    private apiUrl(api: string): string {
        return joinUrls(this.config.crd_portfolioService.url, api);
    }

    private apiPath(api: string): string {
        return new URL(this.apiUrl(api)).pathname;
    }
}

function isPortfolio(value: unknown): value is Portfolio {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const portfolio = value as Record<string, unknown>;
    return typeof portfolio.account === 'string'
        && typeof portfolio.total_asset === 'number'
        && typeof portfolio.vested === 'number'
        && Array.isArray(portfolio.securities)
        && portfolio.securities.every(isSecurity);
}

function isSecurity(value: unknown): value is Security {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const security = value as Record<string, unknown>;
    return typeof security.security === 'string'
        && typeof security.target_percentage === 'number'
        && typeof security.current_percentage === 'number'
        && typeof security.target_variance === 'number'
        && typeof security.unit_price === 'number';
}
