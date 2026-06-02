import assert from 'assert';
import Decimal from 'decimal.js';

// QA-side reference model for the expected CRD portfolio contract.
// It validates mocked response data and calculates expected rebalance results.
// HTTP calls and WireMock fixture lifecycle stay in crd_PortfolioService.ts.
// In a real system, the application service should own this business logic.
// This local model exists to demonstrate test cases while the API is mocked.

export type Security = {
    security: string;
    current_value: number;
    target_percentage: number;
    current_percentage: number;
    target_variance: number;
    unit_price: number;
};

export type Portfolio = {
    account_id: string;
    account_name: string;
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

export class CrdPortfolioModel {
    createPortfolio(accountId: string, asset: PortfolioAsset): Portfolio {
        return {
            account_id: accountId,
            account_name: accountId.toUpperCase(),
            ...asset,
            securities: [],
        };
    }

    mergePortfolioSecurities(portfolio: Portfolio, securities: Security[]): Portfolio {
        const mergedPortfolio = { ...portfolio, securities };
        this.validateSecurityAllocations(mergedPortfolio);

        return this.withDerivedAssetMetadata(mergedPortfolio);
    }

    deriveAssetAllocationMetadata(portfolio: Portfolio): PortfolioAsset {
        const totalAsset = this.totalAssetFrom(portfolio);
        const securitiesValue = sumDecimals(portfolio.securities.map(this.securityValue));
        const cashValue = this.cashValue(portfolio.securities);
        assertDecimalEqual(securitiesValue, totalAsset, 'securities total');

        return {
            total_asset: totalAsset.toNumber(),
            vested: portfolio.vested,
            cash_percentage: totalAsset.isZero() ? 0 : round(cashValue.div(totalAsset).mul(100)),
            stocks_percentage: totalAsset.isZero() ? 0 : round(totalAsset.minus(cashValue).div(totalAsset).mul(100)),
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
            assertDecimalEqual(portfolio.total_asset, derivedAssetMetadata.total_asset, 'total_asset');
            assertDecimalEqual(portfolio.cash_percentage, derivedAssetMetadata.cash_percentage, 'cash_percentage');
            assertDecimalEqual(portfolio.stocks_percentage, derivedAssetMetadata.stocks_percentage, 'stocks_percentage');
        }

        return derivedAssetMetadata;
    }

    balancePortfolio(portfolio: Portfolio): { portfolio: Portfolio; trades: SecurityTrade[] } {
        const sourcePortfolio = this.withDerivedAssetMetadata(portfolio);
        const totalAsset = new Decimal(sourcePortfolio.total_asset);
        let cashValue = this.cashValue(sourcePortfolio.securities);
        const trades: SecurityTrade[] = [];

        const securities = sourcePortfolio.securities
            .filter((security) => security.security !== cashSecurity)
            .map((security) => {
                const targetValue = totalAsset.mul(security.target_percentage).div(100);
                const currentValue = this.securityValue(security);
                const valueDifference = targetValue.minus(currentValue);
                const shares = valueDifference.abs().div(security.unit_price).trunc().toNumber();
                const action = valueDifference.greaterThan(0) ? 'Buy' : valueDifference.lessThan(0) ? 'Sell' : 'No trade';
                const signedShares = action === 'Buy' ? shares : action === 'Sell' ? -shares : 0;

                cashValue = cashValue.minus(new Decimal(security.unit_price).mul(signedShares));
                trades.push({ security: security.security, action, shares, unit_price: security.unit_price });

                return {
                    ...security,
                    current_value: currentValue.plus(new Decimal(security.unit_price).mul(signedShares)).toNumber(),
                };
            });

        assert(cashValue.isPositive() || cashValue.isZero(), `Portfolio rebalance requires ${cashValue.abs()} additional cash`);

        if (cashValue.isPositive()) {
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
                account_id: sourcePortfolio.account_id,
                account_name: sourcePortfolio.account_name,
                total_asset: totalAsset.toNumber(),
                vested: sourcePortfolio.vested,
                securities,
            }),
            trades,
        };
    }

    private withDerivedAssetMetadata(portfolio: Portfolio): Portfolio {
        const assetMetadata = this.deriveAssetAllocationMetadata(portfolio);

        return {
            account_id: portfolio.account_id,
            account_name: portfolio.account_name,
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
                    : round(this.securityValue(security).div(portfolioWithMetadata.total_asset).mul(100));

                return {
                    ...security,
                    current_value: this.securityValue(security).toNumber(),
                    current_percentage: currentPercentage,
                    target_variance: round(new Decimal(currentPercentage).minus(security.target_percentage)),
                };
            }),
        };
    }

    private cashValue(securities: Security[]): Decimal {
        return sumDecimals(
            securities
                .filter((security) => security.security === cashSecurity)
                .map(this.securityValue),
        );
    }

    private securityValue(security: Security): Decimal {
        return new Decimal(security.current_value);
    }

    private totalAssetFrom(portfolio: Portfolio): Decimal {
        assert(typeof portfolio.total_asset === 'number', 'Portfolio total_asset is missing');
        return new Decimal(portfolio.total_asset);
    }

    private validateSecurityAllocations(portfolio: Portfolio): void {
        const totalAsset = this.totalAssetFrom(portfolio);
        portfolio.securities.forEach((security) => {
            const expectedCurrentValue = totalAsset.mul(security.current_percentage).div(100);
            assertDecimalEqual(security.current_value, expectedCurrentValue, `${security.security} current_value`);
            assertDecimalEqual(
                security.target_variance,
                new Decimal(security.current_percentage).minus(security.target_percentage),
                `${security.security} target_variance`,
            );
        });
    }
}

export function isPortfolio(value: unknown): value is Portfolio {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const portfolio = value as Record<string, unknown>;
    return typeof portfolio.account_id === 'string'
        && typeof portfolio.account_name === 'string'
        && typeof portfolio.total_asset === 'number'
        && optionalNumber(portfolio.vested)
        && optionalNumber(portfolio.cash_percentage)
        && optionalNumber(portfolio.stocks_percentage)
        && Array.isArray(portfolio.securities)
        && portfolio.securities.every(isSecurity);
}

export function isPortfolioAccounts(value: unknown): value is PortfolioAccounts {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const portfolioAccounts = value as Record<string, unknown>;
    return Array.isArray(portfolioAccounts.accounts)
        && portfolioAccounts.accounts.every((account) => typeof account === 'string');
}

function assertDecimalEqual(actual: number | Decimal | undefined, expected: number | Decimal, field: string): void {
    assert(actual !== undefined, `Portfolio ${field} cache is missing`);
    assert(new Decimal(actual).equals(expected), `Portfolio ${field} ${actual} does not match expected ${expected}`);
}

function round(value: Decimal): number {
    return value.toDecimalPlaces(4).toNumber();
}

function sumDecimals(values: Decimal[]): Decimal {
    return values.reduce((total, value) => total.plus(value), new Decimal(0));
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
