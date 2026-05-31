import { joinUrls } from './joinUrls';

export type WireMockAdminConfig = {
    wiremock: {
        url: string;
    };
};

const wireMockAdminPaths = {
    health: '/__admin/health',
    mappings: '/__admin/mappings',
};

export type WireMockHealth = {
    status: string;
    version: unknown;
};

export type WireMockMapping = {
    priority: number;
    request: {
        method: string;
        urlPath: string;
    };
    response: {
        status: number;
        headers: Record<string, string>;
        jsonBody: unknown;
    };
};

export async function createWireMockMapping(config: WireMockAdminConfig, mapping: WireMockMapping): Promise<string> {
    const response = await fetch(wireMockAdminUrl(config, wireMockAdminPaths.mappings), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
    });

    if (!response.ok) {
        throw new Error(`Failed to register dynamic WireMock mapping. Status: ${response.status} ${response.statusText}`);
    }

    const createdMapping = await response.json() as { id?: unknown };
    if (typeof createdMapping.id !== 'string') {
        throw new Error('Dynamic WireMock mapping ID is missing');
    }

    return createdMapping.id;
}

export async function removeDynamicMapping(config: WireMockAdminConfig, mappingId?: string): Promise<void> {
    if (!mappingId) {
        return;
    }

    const response = await fetch(`${wireMockAdminUrl(config, wireMockAdminPaths.mappings)}/${mappingId}`, { method: 'DELETE' });

    if (!response.ok) {
        throw new Error(`Failed to remove dynamic WireMock mapping. Status: ${response.status} ${response.statusText}`);
    }
}

export async function checkWireMockHealth(config: WireMockAdminConfig): Promise<WireMockHealth> {
    const healthUrl = wireMockAdminUrl(config, wireMockAdminPaths.health);
    let response: Response;

    try {
        response = await fetch(healthUrl);
    } catch {
        throw new Error(
            `WireMock is not reachable at ${healthUrl}. Start the mock service with 'bun run mock:start' and retry.`,
        );
    }

    if (!response.ok) {
        throw new Error(
            `WireMock health check failed at ${healthUrl}. Status: ${response.status} ${response.statusText}`,
        );
    }

    const health = await response.json() as { status?: unknown; version?: unknown };
    if (health.status !== 'healthy') {
        throw new Error(`WireMock health status is ${String(health.status)}`);
    }

    return {
        status: health.status,
        version: health.version,
    };
}

function wireMockAdminUrl(config: WireMockAdminConfig, path: string): string {
    return joinUrls(config.wiremock.url, path);
}
