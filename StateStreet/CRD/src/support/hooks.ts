import { After, Before, Status } from '@cucumber/cucumber';
import { checkWireMockHealth, removeDynamicMapping } from '../services/wiremockService';
import { log } from './logger';
import { TestWorld } from './world';

// Verify the selected mock dependency before each scenario runs.
Before<TestWorld>({ name: 'Verify WireMock health' }, async function () {
    log(`Test environment: ${this.env.envName}`);
    const health = await checkWireMockHealth(this.env);
    log(`WireMock health: ${health.status}; version: ${String(health.version)}`);
});

// Remove scenario-owned mock data after each scenario.
After<TestWorld>({ name: 'Clean WireMock mappings' }, async function () {
    await removeDynamicMapping(this.env, this.dynamicMappingId);
});

// Preserve failed payloads for diagnosis before scenario-owned mock data is removed.
After<TestWorld>({ name: 'Attach failure diagnostics' }, async function ({ result }) {
    await attachFailureDiagnostics(this, result?.status);
});

async function attachFailureDiagnostics(world: TestWorld, status?: string): Promise<void> {
    if (status === Status.FAILED && world.responseBody !== undefined) {
        await world.attach(JSON.stringify(world.responseBody, null, 2), 'application/json');
    }
}
