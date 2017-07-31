const path = require('path');
const fetch = require('node-fetch');
const notificationModel = require('./notificationModel');
const logger = require('./logger');
const Controller = require('./classes/Controller');
const { db } = require('../database/client');
const queries = require('../api/notification/queries');

const SLEEP_TIME = 1000;

const controller = new Controller({
  script: path.resolve(__dirname, './notificationWorker.js'),
  maxWorkers: 2,
});

controller.setup();

controller.run({
  getData: async (controller) => {
    try {
      while (true && controller.live) {
        let notification = ;
        if (!!notification) {
          return { notification };
        }
        logger.info('[Controller] getData - no data found sleeping for ', SLEEP_TIME);
        await new Promise(resolve => setTimeout(resolve, SLEEP_TIME));
      }
    } catch (err) {
      console.log('error', err);
    }
  },
})
.then(() => logger.debug('Controller was killed'));

// setTimeout(() => {
//   console.log('killing controller');
//   controller.kill();
// }, 5000);
