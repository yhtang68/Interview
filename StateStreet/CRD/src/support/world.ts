import { IWorldOptions, setWorldConstructor, World } from '@cucumber/cucumber';
import type { PortfolioAsset, Security } from '../services/crd_PortfolioService';

export interface TestEnvironment {
    envName: string;
    wiremock: {
        url: string;
    };
    crd_portfolioService: {
        url: string;
    };
    testTrace?: {
        scenarioName: string;
    };
    testDiagnostics?: {
        productRequests: ProductRequestDiagnostic[];
    };
}

export interface TestWorld extends World {
    env: TestEnvironment;
    dynamicMappingIds: Record<string, string>;
    pendingDynamicPortfolios: Record<string, PendingDynamicPortfolio>;
    responseBody?: unknown;
    responseError?: Error;
    resetScenarioState(responseBody?: unknown): void;
}

export type PendingDynamicPortfolio = {
    asset?: PortfolioAsset;
    securities?: Security[];
};

export type ProductRequestDiagnostic = {
    request: {
        method: string;
        url: string;
        headers: Record<string, string>;
    };
    response?: {
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body?: unknown;
    };
    error?: string;
};

export class CustomWorld extends World implements TestWorld {
    env: TestEnvironment;
    dynamicMappingIds: Record<string, string>;
    pendingDynamicPortfolios: Record<string, PendingDynamicPortfolio>;
    responseBody?: unknown;
    responseError?: Error;

    constructor(options: IWorldOptions) {
        super(options);
        const parameters = options.parameters as { env?: unknown };

        if (!isTestEnvironment(parameters.env)) {
            throw new Error('Cucumber world parameters are missing a valid environment configuration');
        }

        this.env = {
            envName: parameters.env.envName,
            wiremock: { ...parameters.env.wiremock },
            crd_portfolioService: { ...parameters.env.crd_portfolioService },
            testDiagnostics: {
                productRequests: [],
            },
        };
        this.dynamicMappingIds = {};
        this.pendingDynamicPortfolios = {};
        this.responseBody = undefined;
        this.responseError = undefined;
    }

    resetScenarioState(responseBody?: unknown): void {
        this.dynamicMappingIds = {};
        this.pendingDynamicPortfolios = {};
        this.responseBody = responseBody;
        this.responseError = undefined;
    }
}

export function isTestEnvironment(value: unknown): value is TestEnvironment {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const env = value as Record<string, unknown>;
    return typeof env.envName === 'string'
        && hasStringUrl(env.wiremock)
        && hasStringUrl(env.crd_portfolioService);
}

function hasStringUrl(value: unknown): value is { url: string } {
    return typeof value === 'object'
        && value !== null
        && typeof (value as Record<string, unknown>).url === 'string';
}

setWorldConstructor(CustomWorld);
