import { setDefaultTimeout } from '@cucumber/cucumber';

const defaultTimeoutSeconds = Number(process.env.CUCUMBER_DEFAULT_TIMEOUT_SECONDS);

if (!Number.isFinite(defaultTimeoutSeconds) || defaultTimeoutSeconds <= 0) {
    throw new Error('CUCUMBER_DEFAULT_TIMEOUT_SECONDS must be a positive number');
}

// Apply the shared step timeout once while Cucumber loads its support code.
setDefaultTimeout(defaultTimeoutSeconds * 1000);
