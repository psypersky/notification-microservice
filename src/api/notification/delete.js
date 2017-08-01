const dbClient = require('../../database/poolClient');

module.exports = async function deleteNotification(ctx) {
  const id = ctx.params.id;

  const notification = await dbClient.db.oneOrNone(
    'DELETE FROM notification where id = $1 returning id',
    [id]
  );

  if (!notification) {
    ctx.response.status = 404;
    ctx.fail({ id: `notification with id ${id} not found` });
    return;
  }

  ctx.success(notification);
};
