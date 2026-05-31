import { Given, Then, DataTable } from '@cucumber/cucumber';
import assert from 'assert';
import {
    CrdPortfolioService,
    Security,
} from '../services/crd_PortfolioService';
import { TestWorld } from '../support/world';

Given('GET portfolio account {string} has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const expectedSecurities = securitiesFrom(dataTable);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    this.responseBody = portfolio;

    assertSecurities(portfolio.securities, expectedSecurities);
});

Given('POST portfolio account {string} has the securities:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = portfolioService.createPortfolio(accountId, securitiesFrom(dataTable));

    this.dynamicMappingId = await portfolioService.registerDynamicPortfolio(accountId, portfolio);
});

Then('portfolio account {string} has the securities balanced:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    this.responseBody = portfolio;
    const expectedRows = dataTable.hashes().map((row) => ({
        security: row.Security,
        target_percentage: optionalNumber(row['Target %']),
        current_percentage: optionalNumber(row['Current %']),
        target_variance: optionalNumber(row['Target Variance']),
        unit_price: optionalNumber(row['Unit Price']),
        action: row.Action,
        shares: Number(row.Shares),
    }));

    assert.strictEqual(portfolio.account, accountId.toUpperCase());
    assert.strictEqual(portfolio.securities.length, expectedRows.length);

    expectedRows.forEach((expected) => {
        const security = portfolio.securities.find((item) => item.security === expected.security);
        assert(security, `Expected security ${expected.security} not found in response`);
        assertOptionalValue(security.target_percentage, expected.target_percentage);
        assertOptionalValue(security.current_percentage, expected.current_percentage);
        assertOptionalValue(security.target_variance, expected.target_variance);
        assertOptionalValue(security.unit_price, expected.unit_price);

        const balance = portfolioService.calculateBalance(portfolio, security);
        assert.strictEqual(balance.action, expected.action);
        assert.strictEqual(balance.shares, expected.shares);
    });
});

function optionalNumber(value: string | undefined): number | undefined {
    return value === undefined || value === '' ? undefined : Number(value);
}

function assertOptionalValue(actual: number, expected: number | undefined): void {
    if (expected !== undefined) {
        assert.strictEqual(actual, expected);
    }
}

function securitiesFrom(dataTable: DataTable): Security[] {
    return dataTable.hashes().map((row) => ({
        security: row.Security,
        target_percentage: Number(row['Target %']),
        current_percentage: Number(row['Current %']),
        target_variance: Number(row['Target Variance']),
        unit_price: Number(row['Unit Price']),
    }));
}

function assertSecurities(actualSecurities: Security[], expectedSecurities: Security[]): void {
    assert.strictEqual(
        actualSecurities.length,
        expectedSecurities.length,
        `Expected ${expectedSecurities.length} securities, but got ${actualSecurities.length}`,
    );

    expectedSecurities.forEach((expected) => {
        const actual = actualSecurities.find((item) => item.security === expected.security);
        assert(actual, `Expected security ${expected.security} not found in response`);
        assert.deepStrictEqual(actual, expected);
    });
}
