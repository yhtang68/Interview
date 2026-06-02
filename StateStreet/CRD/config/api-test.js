// Shared Cucumber configuration for all test environments.
// Each config/env/*.api.conf.js file supplies environment-specific values
// and calls getCucumberConfig() to build its Cucumber profile.

const os = require('os');

function features() {
    const args = process.env.TEST_FEATURE
        ? process.env.TEST_FEATURE.split(' ').map((arg) => arg.trim()).filter(Boolean)
        : [];

    const featurePaths = args.filter((arg) => !arg.startsWith('-'));
    const hasFeaturePath = featurePaths.some((arg) => /\.feature(?::\d+)?$/.test(arg) || arg.includes('*'));
    const featureGlob = (token = '') => `features/**/${token}*.feature`;

    if (featurePaths.length === 0) {
        return [featureGlob()];
    }

    return hasFeaturePath ? featurePaths : featurePaths.map(featureGlob);
}

function setCucumberDefaultTimeoutSeconds(seconds) {
    process.env.CUCUMBER_DEFAULT_TIMEOUT_SECONDS = String(seconds);
}

function getCucumberConfig(envConfig) {
    const env = {
        retryIntervalSeconds: 1,
        retryTimeoutSeconds: 30,
        stepTimeoutSeconds: 30,
        ...envConfig,
    };

    setCucumberDefaultTimeoutSeconds(env.stepTimeoutSeconds);

    return {
        requireModule: ['ts-node/register'],
        backtrace: true,
        worldParameters: { env },
        require: [
            'src/step_definitions/**/*.ts',
            'src/support/**/*.ts',
        ],
        paths: features(),
        format: [
            '@cucumber/pretty-formatter',
            'junit:results/xml/api-cucumber-result.xml',
            'allure-cucumberjs/reporter:results/allure-reporter-output.txt',
        ],
        formatOptions: {
            colorsEnabled: true,
            resultsDir: 'results/allure-results',
            environmentInfo: {
                'Test Runner': process.env.COMPUTERNAME || os.hostname(),
                'Test Runner User': process.env.USERNAME || process.env.USER || os.userInfo().username,
                'Test Env Info': env.crd_portfolioService.url,
                Timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
        },
    };
}

module.exports = {
    getCucumberConfig,
    setCucumberDefaultTimeoutSeconds,
};
