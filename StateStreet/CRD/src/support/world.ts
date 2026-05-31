import { IWorldOptions, setWorldConstructor, World } from '@cucumber/cucumber';

export interface TestEnvironment {
    envName: string;
    wiremockBaseUrl: string;
    portfolioServiceBasePath: string;
    mockStatusPath: string;
}

export interface TestWorld extends World {
    env: TestEnvironment;
    responseBody?: unknown;
}

export class CustomWorld extends World implements TestWorld {
    env: TestEnvironment;
    responseBody?: unknown;

    constructor(options: IWorldOptions) {
        super(options);
        const parameters = options.parameters as { env?: unknown };

        if (!isTestEnvironment(parameters.env)) {
            throw new Error('Cucumber world parameters are missing a valid environment configuration');
        }

        this.env = parameters.env;
        this.responseBody = undefined;
    }
}

function isTestEnvironment(value: unknown): value is TestEnvironment {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const env = value as Record<string, unknown>;
    return typeof env.envName === 'string'
        && typeof env.wiremockBaseUrl === 'string'
        && typeof env.portfolioServiceBasePath === 'string'
        && typeof env.mockStatusPath === 'string';
}

setWorldConstructor(CustomWorld);
