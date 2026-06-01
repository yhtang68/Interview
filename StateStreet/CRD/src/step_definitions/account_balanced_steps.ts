import { DataTable, When } from '@cucumber/cucumber';
import assert from 'assert';
import { CrdPortfolioService, SecurityTrade } from '../services/crd_PortfolioService';
import { TestWorld } from '../support/world';
import { requiredNumber } from './helpers/dataTableHelpers';

When('POST portfolio account {string} has the securities balanced:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolio = await portfolioService.fetchPortfolio(accountId);
    const balanced = portfolioService.balancePortfolio(portfolio);
    const expectedTrades: SecurityTrade[] = dataTable.hashes().map((row) => ({
        security: row.Security,
        action: row.Action,
        shares: requiredNumber(row.Shares, 'Shares'),
        unit_price: requiredNumber(row['Unit Price'], 'Unit Price'),
    }));

    assert.strictEqual(balanced.trades.length, expectedTrades.length);
    expectedTrades.forEach((expected) => {
        const actual = balanced.trades.find((trade) => trade.security === expected.security);
        assert.deepStrictEqual(actual, expected, `Unexpected ${expected.security} trade`);
    });

    const mappingId = this.dynamicMappingIds[accountId];
    assert(mappingId, `Dynamic WireMock mapping is missing for portfolio account ${accountId}`);

    await portfolioService.updateDynamicPortfolio(accountId, mappingId, balanced.portfolio);
    this.responseBody = balanced.portfolio;
});
