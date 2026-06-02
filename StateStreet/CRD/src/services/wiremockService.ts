import { joinUrls } from './joinUrls';

export type WireMockAdminConfig = {
    wiremock: {
        url: string;
    };
};

const wireMockAdminPaths = {
    health: '/__admin/health',
    mappings: '/__admin/mappings',
    findMappingsByMetadata: '/__admin/mappings/find-by-metadata',
    resetMappings: '/__admin/mappings/reset',
};

export type WireMockHealth = {
    status: string;
    version: unknown;
};

export type WireMockMapping = {
    metadata?: Record<string, unknown>;
    priority: number;
    request: {
        method: string;
        urlPath?: string;
        urlPathPattern?: string;
        urlPathTemplate?: string;
    };
    response: {
        status: number;
        headers: Record<string, string>;
        jsonBody?: unknown;
        bodyFileName?: string;
        transformers?: string[];
    };
};

export type RegisteredWireMockMapping = WireMockMapping & {
    id?: string;
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

export async function upsertWireMockMapping(config: WireMockAdminConfig, mapping: WireMockMapping): Promise<string> {
    const mappingKey = mapping.metadata?.mappingKey;
    if (typeof mappingKey !== 'string') {
        throw new Error('Replacing a WireMock mapping requires a metadata mappingKey');
    }

    // Revisions replace an existing dynamic mock by its stable metadata key.
    const matchingIds = (await findWireMockMappingsByMetadata(config, mappingKey))
        .map((existingMapping) => existingMapping.id)
        .filter((mappingId): mappingId is string => typeof mappingId === 'string');

    const [mappingId, ...duplicateMappingIds] = matchingIds;
    await Promise.all(duplicateMappingIds.map((duplicateMappingId) => removeWireMockMapping(config, duplicateMappingId)));

    if (!mappingId) {
        return createWireMockMapping(config, mapping);
    }

    await updateWireMockMapping(config, mappingId, mapping);
    return mappingId;
}

export async function updateWireMockMapping(
    config: WireMockAdminConfig,
    mappingId: string,
    mapping: WireMockMapping,
): Promise<void> {
    const response = await fetch(`${wireMockAdminUrl(config, wireMockAdminPaths.mappings)}/${mappingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
    });

    if (!response.ok) {
        throw new Error(`Failed to update dynamic WireMock mapping. Status: ${response.status} ${response.statusText}`);
    }
}

export async function removeWireMockMapping(config: WireMockAdminConfig, mappingId: string): Promise<void> {
    const response = await fetch(`${wireMockAdminUrl(config, wireMockAdminPaths.mappings)}/${mappingId}`, { method: 'DELETE' });

    if (!response.ok) {
        throw new Error(`Failed to remove WireMock mapping. Status: ${response.status} ${response.statusText}`);
    }
}

export async function fetchWireMockMappings(config: WireMockAdminConfig): Promise<RegisteredWireMockMapping[]> {
    const response = await fetch(wireMockAdminUrl(config, wireMockAdminPaths.mappings));

    if (!response.ok) {
        throw new Error(`Failed to fetch WireMock mappings. Status: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as { mappings?: unknown };
    if (!Array.isArray(body.mappings)) {
        throw new Error('WireMock mappings response payload is invalid');
    }

    return body.mappings as RegisteredWireMockMapping[];
}

export async function resetWireMockMappings(config: WireMockAdminConfig): Promise<void> {
    const resetResponse = await fetch(wireMockAdminUrl(config, wireMockAdminPaths.resetMappings), { method: 'POST' });

    if (!resetResponse.ok) {
        throw new Error(`Failed to reset WireMock mappings. Status: ${resetResponse.status} ${resetResponse.statusText}`);
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

async function findWireMockMappingsByMetadata(config: WireMockAdminConfig, mappingKey: string): Promise<Array<{
    id?: unknown;
}>> {
    const response = await fetch(wireMockAdminUrl(config, wireMockAdminPaths.findMappingsByMetadata), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            matchesJsonPath: {
                expression: '$.mappingKey',
                equalTo: mappingKey,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to find WireMock mappings by metadata. Status: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as { mappings?: unknown };
    if (!Array.isArray(body.mappings)) {
        throw new Error('WireMock mappings response payload is invalid');
    }

    return body.mappings as Array<{ id?: unknown }>;
}

function wireMockAdminUrl(config: WireMockAdminConfig, path: string): string {
    return joinUrls(config.wiremock.url, path);
}
