const pgp = require('pg-promise');
const squel = require('squel').useFlavour('postgres');

const TransactionMode = pgp.txMode.TransactionMode;
const isolationLevel = pgp.txMode.isolationLevel;

// Sets transaction mode to read/write
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

  // Gets the next notification and marks it as processing
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

function getAndMarkAsProcessing() {
  return db.tx(transaction);
}

module.exports = { getAndMarkAsProcessing };
