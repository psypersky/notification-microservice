const _ = require('lodash');

const baseConfig = {
  port: 8080,
  dbConnection: {
    host: 'localhost',
    port: 5432,
    database: 'notifications',
    user: 'notificator',
    max: 10,
    idleTimeoutMillis: 30000,
  },
  update: function newConfig(newConfig) {
    _.merge(this, newConfig);
  },
};

module.exports = baseConfig;
