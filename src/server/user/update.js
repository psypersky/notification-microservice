const squel = require('squel').useFlavour('postgres');
const utils = require('../utils');
const db = require('../../../database/client');

module.exports = async function updateUser(ctx, next) {
  const external_id = ctx.params.id;

  const {
    name,
    email,
    sms,
    voice,
    delivery,
    language,
    timezone,
    active
  } = ctx.request.body;

  const baseQuery = squel.update()
    .table('account')
    .where('external_id = ?', external_id)
    .returning('*');

  if (name) {
    baseQuery.set('name', name);
  }

  if (email) {
    baseQuery.set('email', email);
  }

  if (sms) {
    baseQuery.set('sms', sms);
  }

  if (voice) {
    baseQuery.set('voice', voice);
  }

  if (delivery) {
    baseQuery.set('delivery', utils.pgArr(delivery));
  }

  if (timezone) {
    baseQuery.set('timezone', timezone);
  }

  if (language) {
    baseQuery.set('language', language);
  }

  if (active || active == false) {
    baseQuery.set('timezone', active);
  }

  console.log('Running query', baseQuery.toString());

  let user = await db.oneOrNone(baseQuery.toString());

  if (!user) {
    ctx.response.status = 400;
    ctx.response.body = {
      status: 'fail',
      id: 'not user found for id',
    };
    next();
    return;
  }

  ctx.body = user;
  next();
}
