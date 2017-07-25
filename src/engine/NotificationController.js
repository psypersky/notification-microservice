const path = require('path');
const fetch = require('node-fetch');
const squel = require('squel').useFlavour('postgres');
const pgp = require('pg-promise');
const logger = require('./logger');
const Controller = require('./classes/Controller');
const db = require('../database/client');
const queries = require('../api/notification/queries');

const TransactionMode = pgp.txMode.TransactionMode;
const isolationLevel = pgp.txMode.isolationLevel;

const SLEEP_TIME = 1000;

const controller = new Controller({
  script: path.resolve(__dirname, './notificationWorker.js'),
  maxWorkers: 2,
});

controller.setup();

//Sets transaction mode to read/write
const transactionMode = new TransactionMode({
  tiLevel: isolationLevel.serializable,
  readOnly: false,
});

const getNextNotificationQuery = squel
  .select()
  .from('notification')
  .where('notification.at <= NOW()')
  .where("notification.status = 'new'")
  .order('notification.at')
  .limit(1)
  .toString();

//gets the next notification and marks it as processing
const transaction = async t => {
  try {
    const notification = await t.oneOrNone(getNextNotificationQuery);
    if (!!notification) {
      queries.updateNotification({
        id: notification.id,
        status: 'processing',
      });
    }
    return notification;
  } catch (error) {
    console.log(error);
  }
};

transaction.txMode = transactionMode;

controller.run({
  getData: async (controller) => {
    try {
      while (true && controller.live) {
        let notification = await db.tx(transaction);
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
