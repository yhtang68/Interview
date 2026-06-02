import { DataTable, Then, When } from '@cucumber/cucumber';
import assert from 'assert';
import { CrdPortfolioService, SecurityTrade, TradeAction } from '../services/crd_PortfolioService';
import { TestWorld } from '../support/world';
import { requiredNumber } from './helpers/dataTableHelpers';

When('POST account {string} portfolio has the securities balanced:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const balanced = portfolioService.balancePortfolio(portfolio);
    const expectedTrades: SecurityTrade[] = dataTable.hashes().map((row) => ({
        security: row.Security,
        action: requiredTradeAction(row.Action),
        shares: requiredNumber(row.Shares, 'Shares'),
        unit_price: requiredNumber(row['Unit Price'], 'Unit Price'),
    }));

    assert.strictEqual(balanced.trades.length, expectedTrades.length);
    expectedTrades.forEach((expected) => {
        const actual = balanced.trades.find((trade) => trade.security === expected.security);
        assert.deepStrictEqual(actual, expected, `Unexpected ${expected.security} trade`);
    });

    const mappingId = this.dynamicMappingIds[accountId];
    assert(mappingId, `Dynamic WireMock mapping is missing for account ${accountId} portfolio`);

    await portfolioService.updateDynamicPortfolio(accountId, mappingId, balanced.portfolio);
    this.responseBody = balanced.portfolio;
});

When('POST account {string} portfolio balanced', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    this.responseError = undefined;

    try {
        portfolioService.balancePortfolio(await portfolioService.fetchPortfolio(accountId));
    } catch (error) {
        this.responseError = error instanceof Error ? error : new Error(String(error));
    }
});

Then('the account portfolio insufficient cash error is reported', function (this: TestWorld) {
    assert(this.responseError, 'Expected portfolio rebalance to fail');
    assert.match(this.responseError.message, /requires .* additional cash/);
});

function requiredTradeAction(value: string): TradeAction {
    assert(value === 'Buy' || value === 'Sell' || value === 'No trade', `Unexpected trade action: ${value}`);
    return value;
}
