import { Given, Then, DataTable } from '@cucumber/cucumber';
import assert from 'assert';
import { log } from '../support/logger';
import { TestWorld } from '../support/world';

type Security = {
    security: string;
    target_percentage: number;
    current_percentage: number;
    target_variance: number;
    unit_price: number;
};

Given('mock is up', async function (this: TestWorld) {
    log(`Test environment: ${this.env.envName}`);
    const healthUrl = `${this.env.wiremockBaseUrl}${this.env.mockHealthPath}`;
    const response = await fetch(healthUrl);

    if (!response.ok) {
        throw new Error(`Wiremock did not respond as expected. Status: ${response.status} ${response.statusText}`);
    }

    const health = await response.json() as { status?: unknown; version?: unknown };
    assert.strictEqual(health.status, 'healthy', `Wiremock health status is ${String(health.status)}`);
    log(`WireMock health: ${health.status}; version: ${String(health.version)}`);
});

Then('GET portfolio account {string} returns the securities data table:', async function (this: TestWorld, accountId: string, dataTable: DataTable) {
    const url = `${this.env.wiremockBaseUrl}${this.env.portfolioServiceBasePath}/accounts/${accountId}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch mock account data. Status: ${response.status} ${response.statusText}`);
    }

    this.responseBody = await response.json();
    assert(this.responseBody, 'Response payload is missing');

    const responseBody = this.responseBody as { securities?: unknown };
    assert(Array.isArray(responseBody.securities), 'Response does not contain securities array');
    const securities = responseBody.securities;

    const expectedRows = dataTable.hashes().map((row) => ({
        security: row.Security,
        target_percentage: Number(row['Target %']),
        current_percentage: Number(row['Current %']),
        target_variance: Number(row['Target Variance']),
        unit_price: Number(row['Unit Price']),
    }));

    assert.strictEqual(
        securities.length,
        expectedRows.length,
        `Expected ${expectedRows.length} securities, but got ${securities.length}`,
    );

    expectedRows.forEach((expected) => {
        const actual = securities.find((item: unknown): item is Security => (
            isSecurity(item) && item.security === expected.security
        ));
        assert(actual, `Expected security ${expected.security} not found in response`);
        assert.strictEqual(actual.security, expected.security);
        assert.strictEqual(actual.target_percentage, expected.target_percentage);
        assert.strictEqual(actual.current_percentage, expected.current_percentage);
        assert.strictEqual(actual.target_variance, expected.target_variance);
        assert.strictEqual(actual.unit_price, expected.unit_price);
    });
});

function isSecurity(value: unknown): value is Security {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const security = value as Record<string, unknown>;
    return typeof security.security === 'string'
        && typeof security.target_percentage === 'number'
        && typeof security.current_percentage === 'number'
        && typeof security.target_variance === 'number'
        && typeof security.unit_price === 'number';
}
