import { IWorldOptions, setWorldConstructor, World } from '@cucumber/cucumber';

export interface TestEnvironment {
    envName: string;
    wiremock: {
        url: string;
    };
    crd_portfolioService: {
        url: string;
    };
}

export interface TestWorld extends World {
    env: TestEnvironment;
    dynamicMappingId?: string;
    responseBody?: unknown;
}

export class CustomWorld extends World implements TestWorld {
    env: TestEnvironment;
    dynamicMappingId?: string;
    responseBody?: unknown;

    constructor(options: IWorldOptions) {
        super(options);
        const parameters = options.parameters as { env?: unknown };

        if (!isTestEnvironment(parameters.env)) {
            throw new Error('Cucumber world parameters are missing a valid environment configuration');
        }

        this.env = parameters.env;
        this.dynamicMappingId = undefined;
        this.responseBody = undefined;
    }
}

function isTestEnvironment(value: unknown): value is TestEnvironment {
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
