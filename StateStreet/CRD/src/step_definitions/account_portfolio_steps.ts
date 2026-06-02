import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import assert from 'assert';

import {
    CrdPortfolioService,
    PortfolioAsset,
    Security,
} from '../services/crd_PortfolioService';
import { log } from '../support/logger';
import { TestWorld } from '../support/world';
import { requiredNumber } from './helpers/dataTableHelpers';

type ExpectedSecurity = Partial<Omit<Security, 'security'>> & Pick<Security, 'security'>;

Given('GET account {string} portfolio has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    this.responseBody = portfolio;

    const expectedSecurities: ExpectedSecurity[] = dataTable.hashes().map((row) => ({
        security: row.Security,
        current_value: optionalNumber(row['Current Value']),
        target_percentage: optionalNumber(row['Target %']),
        current_percentage: optionalNumber(row['Current %']),
        target_variance: optionalNumber(row['Target Variance %']),
        unit_price: optionalNumber(row['Unit Price']),
    }));

    assertSecurities(portfolio.securities, expectedSecurities);
});

Given('POST account {string} portfolio has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    await stageDynamicPortfolio(this, accountId, {
        securities: dataTable.hashes().map((row) => ({
            security: row.Security,
            current_value: requiredNumber(row['Current Value'], 'Current Value'),
            target_percentage: requiredNumber(row['Target %'], 'Target %'),
            current_percentage: requiredNumber(row['Current %'], 'Current %'),
            target_variance: requiredNumber(row['Target Variance %'], 'Target Variance %'),
            unit_price: requiredNumber(row['Unit Price'], 'Unit Price'),
        })),
    });
});

Given('POST account {string} portfolio has asset:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    await stageDynamicPortfolio(this, accountId, { asset: assetFrom(dataTable) });
});

Given('account {string} portfolio has a malformed response', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    this.dynamicMappingIds[accountId] = await portfolioService.registerDynamicPortfolioResponse(accountId, 200, {
        account_id: accountId,
    });
});

Given('account {string} portfolio responds with a dependency failure', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    this.dynamicMappingIds[accountId] = await portfolioService.registerDynamicPortfolioResponse(accountId, 503, {
        error: 'Portfolio dependency is unavailable',
    });
});

When('GET account {string} portfolio', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    this.responseError = undefined;

    try {
        this.responseBody = await portfolioService.fetchPortfolio(accountId);
    } catch (error) {
        this.responseError = error instanceof Error ? error : new Error(String(error));
    }
});

Then('GET account {string} portfolio has asset:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const validatedAssetMetadata = portfolioService.validatePortfolioAssetMetadata(portfolio);
    const expectedAsset = assetFrom(dataTable);
    this.responseBody = portfolio;

    if (portfolioService.hasCompleteAssetMetadata(portfolio)) {
        log(`Account ${accountId} portfolio asset metadata matches the securities allocation.`);
    } else {
        log(`Account ${accountId} portfolio derived asset metadata is missing; derived allocation percentages from securities. Patch the fixture metadata.`, 'warning');
    }

    assert.strictEqual(validatedAssetMetadata.total_asset, expectedAsset.total_asset, 'Unexpected total asset');
    assert.strictEqual(validatedAssetMetadata.vested, expectedAsset.vested, 'Unexpected vested percentage');
    assert.strictEqual(validatedAssetMetadata.cash_percentage, expectedAsset.cash_percentage, 'Unexpected cash percentage');
    assert.strictEqual(validatedAssetMetadata.stocks_percentage, expectedAsset.stocks_percentage, 'Unexpected stocks percentage');
});

Then('GET account {string} portfolio has identity:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const [row] = dataTable.hashes();
    assert(row, 'Expected one portfolio identity row');
    this.responseBody = portfolio;

    assert.strictEqual(portfolio.account_id, row['Account ID'], 'Unexpected account ID');
    assert.strictEqual(portfolio.account_name, row['Account Name'], 'Unexpected account name');
});

When('DELETE account {string} portfolio', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.removeAccountPortfolio(accountId);

    for (const key of Object.keys(this.dynamicMappingIds)) {
        if (key.toLowerCase() === accountId.toLowerCase()) {
            delete this.dynamicMappingIds[key];
        }
    }

    for (const key of Object.keys(this.pendingDynamicPortfolios)) {
        if (key.toLowerCase() === accountId.toLowerCase()) {
            delete this.pendingDynamicPortfolios[key];
        }
    }
});

Then('GET account {string} portfolio is missing', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    assert(!(await portfolioService.hasPortfolio(accountId)), `Expected account "${accountId}" portfolio to be missing`);
});

Then('the account portfolio response is rejected as malformed', function (this: TestWorld) {
    assert.match(requiredResponseError(this).message, /response payload is invalid/);
});

Then('the account portfolio dependency failure is reported', function (this: TestWorld) {
    assert.match(requiredResponseError(this).message, /Status: 503/);
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
        log(`Account ${accountId} portfolio setup fragment staged; waiting for matching asset metadata and securities.`);
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
    log(`Account ${accountId} portfolio asset metadata and securities merged, validated, and published.`);
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

function optionalNumber(value: string | undefined): number | undefined {
    return value === undefined || value === '' ? undefined : requiredNumber(value, 'table value');
}

function requiredResponseError(world: TestWorld): Error {
    assert(world.responseError, 'Expected portfolio request to fail');
    return world.responseError;
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
