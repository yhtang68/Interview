import { After, BeforeAll, Status } from '@cucumber/cucumber';
import { checkWireMockHealth, resetWireMockMappings } from '../services/wiremockService';
import { log } from './logger';
import { isTestEnvironment, TestEnvironment, TestWorld } from './world';

// Reset prior debug data once per run while restoring the file-backed static mappings.
BeforeAll({ name: 'Prepare WireMock mappings' }, async function () {
    const env = testEnvironmentFrom(this.parameters);
    log(`Test environment: ${env.envName}`);
    const health = await checkWireMockHealth(env);
    log(`WireMock health: ${health.status}; version: ${String(health.version)}`);
    await resetWireMockMappings(env);
    log('WireMock mappings reset to the static file-backed baseline.');
});

// Preserve failed payloads for diagnosis while retaining mock data for debugging.
After<TestWorld>({ name: 'Attach failure diagnostics' }, async function ({ result }) {
    await attachFailureDiagnostics(this, result?.status);
});

function testEnvironmentFrom(parameters: unknown): TestEnvironment {
    const value = parameters as { env?: unknown };

    if (!isTestEnvironment(value.env)) {
        throw new Error('Cucumber run parameters are missing a valid environment configuration');
    }

    return value.env;
}

async function attachFailureDiagnostics(world: TestWorld, status?: string): Promise<void> {
    if (status === Status.FAILED && world.responseBody !== undefined) {
        await world.attach(JSON.stringify(world.responseBody, null, 2), 'application/json');
    }
}
