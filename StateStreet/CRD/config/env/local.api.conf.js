const { getCucumberConfig } = require('../api-test');

const env = {
    envName: 'local',
    wiremockBaseUrl: 'http://localhost:9999',
    portfolioServiceBasePath: '/state-street/crd/portfolioService',
    mockHealthPath: '/__admin/health',
};

module.exports = {
    default: getCucumberConfig(env),
    env,
};
