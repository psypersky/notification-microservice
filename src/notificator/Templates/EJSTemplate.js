const Template = require('./TemplateBase');
const ejs = require('ejs');

module.exports = class EJSTemplate extends Template {
  constructor(id) {
    super(id);
  }

  async renderEmail({ user, data }) {
    await this.load();

    const template = this.template.email;
    return this.ejsRender(template, { user, notificationData: data });
  }

  async renderSms({ user, data }) {
    await this.load();

    const template = this.template.sms;
    return this.ejsRender(template, { user, notificationData: data });
  }

  async renderPush({ user, data = {} }) {
    await this.load();
    const template = this.template.push;
    /*
      With this implementation push data is loaded into the returned message by the ejsTemplate from the data object
      passed in with the notification. If pushData isn't specified then its set as an empty object. Requires the
      data parameter to never be null. Could change schema to set data of notification to NOT NULL
     */
    return {
      notification: this.ejsRender(template, { user, notificationData: data }),
      data: data.pushData || {},
    };
  }

  async renderWeb({ user, data = {} }) {
    await this.load();
    const template = this.template.push;
    return {
      notification: this.ejsRender(template, { user, notificationData: data }),
      data: data.pushData || {},
    };
  }

  /**
   *  ejsRender can now render templates with multiple layers, and can render strings in arrays as well.
   * @param template
   * @param data
   * @returns {Object}
   */
  ejsRender(template, data) {
    return Object.keys(template).map(value => {
      if (Array.isArray(value)) {
        return value.map(ejs.render(elem, data));
      } else if (typeof value === 'object') {
        return this.ejsRender(value, data);
      }
      return this.ejsRender(value, data);
    });
  }
};