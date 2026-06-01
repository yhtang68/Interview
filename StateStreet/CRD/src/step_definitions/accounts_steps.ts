import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import assert from 'assert';
import { CrdPortfolioService } from '../services/crd_PortfolioService';
import { TestWorld } from '../support/world';

Given('POST account system reset', async function (this: TestWorld) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.resetPortfolioAccountSystem();
    this.resetScenarioState();
});

When('POST account {string}', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.registerPortfolioAccount(accountId);
});

When('POST clear accounts', async function (this: TestWorld) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.clearPortfolioAccounts();
    this.resetScenarioState({ accounts: [] });
});

Then('GET accounts has:', async function (this: TestWorld, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolioAccounts = await portfolioService.fetchPortfolioAccounts();
    this.responseBody = portfolioAccounts;

    dataTable.hashes().map((row) => row.Account).forEach((expectedAccount) => {
        assert(
            portfolioAccounts.accounts.includes(expectedAccount),
            `Expected portfolio account ${expectedAccount} not found in response`,
        );
    });
});

Then('GET accounts is empty', async function (this: TestWorld) {
    const portfolioService = new CrdPortfolioService(this.env);
    const portfolioAccounts = await portfolioService.fetchPortfolioAccounts();
    this.responseBody = portfolioAccounts;

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
