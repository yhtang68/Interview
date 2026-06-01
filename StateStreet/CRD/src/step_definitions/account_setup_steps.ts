import { DataTable, Given, Then } from '@cucumber/cucumber';
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

Given('GET portfolio account {string} has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
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

Given('POST portfolio account {string} has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
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

Given('POST portfolio account {string} has asset:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    await stageDynamicPortfolio(this, accountId, { asset: assetFrom(dataTable) });
});

Then('GET portfolio account {string} has asset:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const validatedAssetMetadata = portfolioService.validatePortfolioAssetMetadata(portfolio);
    const expectedAsset = assetFrom(dataTable);
    this.responseBody = portfolio;

    if (portfolioService.hasCompleteAssetMetadata(portfolio)) {
        log(`Portfolio account ${accountId} asset metadata matches the securities allocation.`);
    } else {
        log(`Portfolio account ${accountId} derived asset metadata is missing; derived allocation percentages from securities. Patch the fixture metadata.`, 'warning');
    }

    assert.strictEqual(validatedAssetMetadata.total_asset, expectedAsset.total_asset, 'Unexpected total asset');
    assert.strictEqual(validatedAssetMetadata.vested, expectedAsset.vested, 'Unexpected vested percentage');
    assert.strictEqual(validatedAssetMetadata.cash_percentage, expectedAsset.cash_percentage, 'Unexpected cash percentage');
    assert.strictEqual(validatedAssetMetadata.stocks_percentage, expectedAsset.stocks_percentage, 'Unexpected stocks percentage');
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
