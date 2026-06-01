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

Given('POST account system reset', async function (this: TestWorld) {
    await resetPortfolioAccountSystem(this);
});

Given('GET portfolio account {string} has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    this.responseBody = portfolio;

    assertSecurities(portfolio.securities, expectedSecuritiesFrom(dataTable));
});

Given('POST portfolio account {string} has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    await stageDynamicPortfolio(this, accountId, { securities: securitiesFrom(dataTable) });
});

Given('POST portfolio account {string} has asset:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    await stageDynamicPortfolio(this, accountId, { asset: assetFrom(dataTable) });
});

When('POST account {string}', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.registerPortfolioAccount(accountId);
});

async function stageDynamicPortfolio(
    world: TestWorld,
    accountId: string,
    fragment: TestWorld['pendingDynamicPortfolios'][string],
): Promise<void> {
    const pendingPortfolio = {
        ...world.pendingDynamicPortfolios[accountId],
        ...fragment,
    };
    world.pendingDynamicPortfolios[accountId] = pendingPortfolio;

    if (!pendingPortfolio.asset || !pendingPortfolio.securities) {
        log(`Portfolio account ${accountId} setup fragment staged; waiting for matching asset metadata and securities.`);
        return;
    }

    const portfolioService = new CrdPortfolioService(world.env);
    const portfolio = portfolioService.mergePortfolioSecurities(
        portfolioService.createPortfolio(accountId, pendingPortfolio.asset),
        pendingPortfolio.securities,
    );

    world.dynamicMappingIds[accountId] = await portfolioService.registerDynamicPortfolio(accountId, portfolio);
    delete world.pendingDynamicPortfolios[accountId];
    world.responseBody = portfolio;
    log(`Portfolio account ${accountId} asset metadata and securities merged, validated, and published.`);
}

When('POST portfolio account {string} has the securities balanced:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const balanced = portfolioService.balancePortfolio(portfolio);

    assertTrades(balanced.trades, tradesFrom(dataTable));
    const mappingId = this.dynamicMappingIds[accountId];
    assert(mappingId, `Dynamic WireMock mapping is missing for portfolio account ${accountId}`);

    await portfolioService.updateDynamicPortfolio(accountId, mappingId, balanced.portfolio);
    this.responseBody = balanced.portfolio;
});

Then('GET portfolio account {string} has asset:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const validatedAssetMetadata = portfolioService.validatePortfolioAssetMetadata(portfolio);
    this.responseBody = portfolio;

    if (portfolioService.hasCompleteAssetMetadata(portfolio)) {
        log(`Portfolio account ${accountId} asset metadata matches the securities allocation.`);
    } else {
        log(`Portfolio account ${accountId} derived asset metadata is missing; derived allocation percentages from securities. Patch the fixture metadata.`, 'warning');
    }

    assertAsset(validatedAssetMetadata, assetFrom(dataTable));
});

When('POST clear accounts', async function (this: TestWorld) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.clearPortfolioAccounts();

    this.dynamicMappingIds = {};
    this.pendingDynamicPortfolios = {};
    this.responseBody = { accounts: [] };
});

Then('GET accounts has:', async function (this: TestWorld, dataTable: DataTable) {
    const portfolioAccounts = await fetchPortfolioAccounts(this);

    accountNamesFrom(dataTable).forEach((expectedAccount) => {
        assert(
            portfolioAccounts.accounts.includes(expectedAccount),
            `Expected portfolio account ${expectedAccount} not found in response`,
        );
    });
});

Then('GET accounts is empty', async function (this: TestWorld) {
    const portfolioAccounts = await fetchPortfolioAccounts(this);
    assert.deepStrictEqual(portfolioAccounts.accounts, []);
});

Then('GET portfolio account {string} exists', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    assert(await portfolioService.hasPortfolio(accountId), `Expected portfolio account ${accountId} to exist`);
});

Then('GET portfolio account {string} is missing', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    assert(!(await portfolioService.hasPortfolio(accountId)), `Expected portfolio account ${accountId} to be missing`);
});

async function fetchPortfolioAccounts(world: TestWorld) {
    const portfolioService = new CrdPortfolioService(world.env);
    const portfolioAccounts = await portfolioService.fetchPortfolioAccounts();
    world.responseBody = portfolioAccounts;

    return portfolioAccounts;
}

async function resetPortfolioAccountSystem(world: TestWorld): Promise<void> {
    const portfolioService = new CrdPortfolioService(world.env);
    await portfolioService.resetPortfolioAccountSystem();

    world.dynamicMappingIds = {};
    world.pendingDynamicPortfolios = {};
    world.responseBody = undefined;
}

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

function accountNamesFrom(dataTable: DataTable): string[] {
    return dataTable.hashes().map((row) => row.Account);
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
