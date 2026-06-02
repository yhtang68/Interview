const { getCucumberConfig } = require('../api-test');

const mockUrl = 'http://localhost:9999';

const env = {
    envName: 'local',
    wiremock: {
        url: mockUrl,
    },
    crd_portfolioService: {
        url: `${mockUrl}/state-street/crd/portfolioService`,
    },
};

module.exports = {
    default: getCucumberConfig(env),
    env,
};
