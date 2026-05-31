import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import assert from 'assert';
import {
    CrdPortfolioService,
    PortfolioAsset,
    Security,
    SecurityTrade,
} from '../services/crd_PortfolioService';
import { log } from '../support/logger';
import { TestWorld } from '../support/world';

type ExpectedSecurity = Partial<Omit<Security, 'security'>> & Pick<Security, 'security'>;

Given('GET portfolio account {string} has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    this.responseBody = portfolio;

    assertSecurities(portfolio.securities, expectedSecuritiesFrom(dataTable));
});

Given('POST portfolio account {string} has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = portfolioService.createPortfolio(accountId, securitiesFrom(dataTable));

    this.dynamicMappingId = await portfolioService.registerDynamicPortfolio(accountId, portfolio);
    this.responseBody = portfolio;
});

Given('POST portfolio account {string} has asset:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    await refreshPortfolioAsset(this, accountId, dataTable);
});

Given('POST portfolio account {string} has asset', async function (this: TestWorld, accountId: string) {
    await refreshPortfolioAsset(this, accountId);
});

async function refreshPortfolioAsset(world: TestWorld, accountId: string, dataTable?: DataTable): Promise<void> {
    const portfolioService = new CrdPortfolioService(world.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const calculatedAsset = portfolioService.assertAssetCacheMatches(portfolio);
    let vested = portfolio.vested;

    if (dataTable) {
        const expectedAsset = assetFrom(dataTable);
        assert.strictEqual(calculatedAsset.total_asset, expectedAsset.total_asset, 'Unexpected total asset');
        assert.strictEqual(calculatedAsset.cash_percentage, expectedAsset.cash_percentage, 'Unexpected cash percentage');
        assert.strictEqual(calculatedAsset.stocks_percentage, expectedAsset.stocks_percentage, 'Unexpected stocks percentage');
        vested = expectedAsset.vested;
        log(`Portfolio account ${accountId} total asset reference matches the calculated securities value.`);
        log(`Portfolio account ${accountId} vested percentage stored from the account-level reference.`);
    }

    assert(world.dynamicMappingId, `Dynamic WireMock mapping is missing for portfolio account ${accountId}`);

    const refreshedPortfolio = portfolioService.refreshAssetCache(portfolio, vested);
    await portfolioService.updateDynamicPortfolio(accountId, world.dynamicMappingId, refreshedPortfolio);
    world.responseBody = refreshedPortfolio;
    log(`Portfolio account ${accountId} asset cache refreshed from securities.`);
}

When('POST portfolio account {string} has the securities balanced:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const balanced = portfolioService.balancePortfolio(portfolio);

    assertTrades(balanced.trades, tradesFrom(dataTable));
    assert(this.dynamicMappingId, `Dynamic WireMock mapping is missing for portfolio account ${accountId}`);

    await portfolioService.updateDynamicPortfolio(accountId, this.dynamicMappingId, balanced.portfolio);
    this.responseBody = balanced.portfolio;
});

Then('GET portfolio account {string} has asset:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const calculatedAsset = portfolioService.assertAssetCacheMatches(portfolio);
    this.responseBody = portfolio;

    if (portfolioService.hasAssetCache(portfolio)) {
        log(`Portfolio account ${accountId} asset cache matches the calculated securities value.`);
    } else {
        log(`Portfolio account ${accountId} asset cache is missing; calculated the asset from securities. Patch the fixture cache.`, 'warning');
    }

    assertAsset(calculatedAsset, assetFrom(dataTable));
});

function securitiesFrom(dataTable: DataTable): Security[] {
    return dataTable.hashes().map((row) => ({
        security: row.Security,
        current_value: requiredNumber(row['Current Value'], 'Current Value'),
        target_percentage: requiredNumber(row['Target %'], 'Target %'),
        current_percentage: requiredNumber(row['Current %'], 'Current %'),
        target_variance: requiredNumber(row['Target Variance %'], 'Target Variance %'),
        unit_price: requiredNumber(row['Unit Price'], 'Unit Price'),
    }));
}

function expectedSecuritiesFrom(dataTable: DataTable): ExpectedSecurity[] {
    return dataTable.hashes().map((row) => ({
        security: row.Security,
        current_value: optionalNumber(row['Current Value']),
        target_percentage: optionalNumber(row['Target %']),
        current_percentage: optionalNumber(row['Current %']),
        target_variance: optionalNumber(row['Target Variance %']),
        unit_price: optionalNumber(row['Unit Price']),
    }));
}

function tradesFrom(dataTable: DataTable): SecurityTrade[] {
    return dataTable.hashes().map((row) => ({
        security: row.Security,
        action: row.Action,
        shares: requiredNumber(row.Shares, 'Shares'),
        unit_price: requiredNumber(row['Unit Price'], 'Unit Price'),
    }));
}

function assetFrom(dataTable: DataTable): PortfolioAsset {
    const [row] = dataTable.hashes();
    assert(row, 'Expected one portfolio asset row');

    return {
        total_asset: currencyNumber(row['Total Asset']),
        vested: requiredNumber(row['Vested %'], 'Vested %') / 100,
        cash_percentage: requiredNumber(row['Cash %'], 'Cash %'),
        stocks_percentage: requiredNumber(row['Stocks %'], 'Stocks %'),
    };
}

function currencyNumber(value: string | undefined): number {
    return requiredNumber(value?.replace(/^\$/, ''), 'Total Asset');
}

function requiredNumber(value: string | undefined, field: string): number {
    const number = Number(value);
    assert(value !== undefined && value !== '' && Number.isFinite(number), `Expected ${field} to be a number`);
    return number;
}

function optionalNumber(value: string | undefined): number | undefined {
    return value === undefined || value === '' ? undefined : requiredNumber(value, 'table value');
}

function assertSecurities(actualSecurities: Security[], expectedSecurities: ExpectedSecurity[]): void {
    assert.strictEqual(
        actualSecurities.length,
        expectedSecurities.length,
        `Expected ${expectedSecurities.length} securities, but got ${actualSecurities.length}`,
    );

    expectedSecurities.forEach((expected) => {
        const actual = actualSecurities.find((security) => security.security === expected.security);
        assert(actual, `Expected security ${expected.security} not found in response`);

        Object.entries(expected).forEach(([field, value]) => {
            if (value !== undefined) {
                assert.strictEqual(actual[field as keyof Security], value, `Unexpected ${expected.security} ${field}`);
            }
        });
    });
}

function assertTrades(actualTrades: SecurityTrade[], expectedTrades: SecurityTrade[]): void {
    assert.strictEqual(actualTrades.length, expectedTrades.length);

    expectedTrades.forEach((expected) => {
        const actual = actualTrades.find((trade) => trade.security === expected.security);
        assert.deepStrictEqual(actual, expected, `Unexpected ${expected.security} trade`);
    });
}

function assertAsset(actual: PortfolioAsset, expected: PortfolioAsset): void {
    assert.strictEqual(actual.total_asset, expected.total_asset, 'Unexpected total asset');
    assert.strictEqual(actual.vested, expected.vested, 'Unexpected vested percentage');
    assert.strictEqual(actual.cash_percentage, expected.cash_percentage, 'Unexpected cash percentage');
    assert.strictEqual(actual.stocks_percentage, expected.stocks_percentage, 'Unexpected stocks percentage');
}
