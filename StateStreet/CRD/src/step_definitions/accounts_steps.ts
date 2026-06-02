import { DataTable, Given, Then, When } from '@cucumber/cucumber';
import assert from 'assert';
import { CrdPortfolioService, PortfolioAccounts } from '../services/crd_PortfolioService';
import { TestWorld } from '../support/world';

Given('POST account system reset', async function (this: TestWorld) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.resetPortfolioAccountSystem();
    this.resetScenarioState();
});

When('POST accounts:', async function (this: TestWorld, dataTable: DataTable) {
    const portfolioService = new CrdPortfolioService(this.env);

    for (const row of dataTable.hashes()) {
        await portfolioService.registerPortfolioAccount(row.Account);
    }
});

When('DELETE account {string}', async function (this: TestWorld, accountId: string) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.removePortfolioAccount(accountId);
});

When('POST clear accounts', async function (this: TestWorld) {
    const portfolioService = new CrdPortfolioService(this.env);
    await portfolioService.clearPortfolioAccounts();
    this.resetScenarioState({ accounts: [] });
});

Then('GET accounts has:', async function (this: TestWorld, dataTable: DataTable) {
    const portfolioAccounts = await fetchPortfolioAccounts(this);

    dataTable.hashes().map((row) => row.Account).forEach((expectedAccount) => {
        assert(
            portfolioAccounts.accounts.includes(expectedAccount),
            `Expected account ${expectedAccount} not found in response`,
        );
    });
});

Then('GET accounts is:', async function (this: TestWorld, dataTable: DataTable) {
    const portfolioAccounts = await fetchPortfolioAccounts(this);

    assert.deepStrictEqual(portfolioAccounts.accounts, dataTable.hashes().map((row) => row.Account));
});

Then('GET accounts is empty', async function (this: TestWorld) {
    const portfolioAccounts = await fetchPortfolioAccounts(this);

    assert.deepStrictEqual(portfolioAccounts.accounts, []);
});

async function fetchPortfolioAccounts(world: TestWorld): Promise<PortfolioAccounts> {
    const portfolioService = new CrdPortfolioService(world.env);
    const portfolioAccounts = await portfolioService.fetchPortfolioAccounts();
    world.responseBody = portfolioAccounts;

    return portfolioAccounts;
}
