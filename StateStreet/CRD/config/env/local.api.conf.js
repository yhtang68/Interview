const { getCucumberConfig } = require('../api-test');

const env = {
    envName: 'local',
    wiremockBaseUrl: 'http://localhost:9999',
    portfolioServiceBasePath: '/state-street/crd/portfolioService',
    mockStatusPath: '/__admin/mappings',
};

module.exports = {
    default: getCucumberConfig(env),
    env,
};
