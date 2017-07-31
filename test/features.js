const request = require('supertest');
const expect = require('chai').expect;
const { API } = require('../src');

let api;
let server;
const apiConfig = {
  port: 8080,
  dbConnection: {
    database: "notifications-test",
  },
};


// ==> Feature testing
// Boot API
// Ping API
// Create an user
// Register user token
// Unregister user token

// Create a template
// Delete template

// Create a notification
// Delete a notification

// ==> Functionality testing
// Boot api
// Boot engine

// Create two users
// Register user tokens
// Create two templates
// Create four notification each one for each user

// Wait until engine has a count of sent notifications of four


describe('API', () => {
  describe('Start', function() {
    it('should intialize server', async () => {
      const api = new API(apiConfig);
      api.start(() => console.log(`notifications-microservice listening on ${apiConfig.port}`));
      server = api.server;
    });
  });

  describe('Ping', () => {
    it('should return ping success', async () => {
      const res = await request(server).get('/api/ping').expect(200);
      expect(res.body).to.be.an('object');
      expect(res.body.data.time).to.be.a('number');
    });
  });

  describe('User', () => {
    it('should create an user successfully', async() => {
      const res = await request(server)
        .post('/api/user')
        .send({
          external_id: 'test-user-001',
          name: 'test-user-001',
          email: 'info+test-user-001@joinlane.com',
          delivery: ['email'],
          groups: ['test-group-1', 'test-group-2'],
        })
        .set('Accept', 'application/json')
        .expect(200);

        expect(res.body.data.external_id).to.equal('test-user-001');
    });
  });

  describe('Template', () => {
    it('should create a template successfully', async() => {
      const res = await request(server)
        .post('/api/user')
        .send({
          external_id: 'test-user-001',
          name: 'test-user-001',
          email: 'info+test-user-001@joinlane.com',
          delivery: ['email'],
          groups: ['test-group-1', 'test-group-2'],
        })
        .set('Accept', 'application/json')
        .expect(200);

        expect(res.body.data.external_id).to.equal('test-user-001');
    });
  });
});
