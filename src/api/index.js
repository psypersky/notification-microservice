const _ = require('lodash');
const logger = require('./logger');
const configStore = require('./configStore');
const server = require('./server');
const dbClient = require('../database');

const defaultConfig = {
  port: 8080,
  dbConnection: {
    host: 'localhost',
    port: 5432,
    database: 'notifications',
    user: 'notificator',
    max: 10,
    idleTimeoutMillis: 30000,
  },
};

class Server {
  constructor(config) {
    configStore.update(_.merge(defaultConfig, config));
    this.server = null;
  }

  /** Connect to db and start api server **/
  start(cb = () => {}) {
    dbClient.connect(configStore.config.dbConnection);
    this.server = server.listen(configStore.config.port, cb);
  }

  stop() {
    // TODO: stop server
  }
}

module.exports = Server;
