const cp = require('child_process');
const logger = require('../logger');
const NUM_CPU = require('os').cpus().length;
const THROTTLE = 20; // ms;
const DEADLOCK_THROTTLE = 1800000; // 30 minutes default
const CHECK_THROTTLE = 1000;

module.exports = class Controller {
  constructor({ transports = transports, maxWorkers = NUM_CPU, script }) {
    this.transports = transports;
    this.workers = {};
    this.maxWorkers = maxWorkers;
    this.script = script;
    this.live = true;
  }

  restartWorker(workerProcess) {
    const id = workerProcess.whoAmI;
    logger.warn('[Controller] restarting worker with id', id);
    this.killWorker(workerProcess);

    this.workers[id] = this.createWorker(id);
  }

  killWorker(workerProcess) {
    const id = workerProcess.whoAmI;
    clearInterval(workerProcess.pingInterval);
    clearTimeout(workerProcess.deadLockTimeout);
    workerProcess.kill();
  }

  createWorker(id) {
    const workerProcess = cp.fork(this.script);

    // Initial tracking state for worker
    workerProcess.whoAmI = id;
    workerProcess.available = false; // Track if worker is bussy
    workerProcess.crashed = false; // Track if responds to pings

    // Let the worker know which ID it is.
    workerProcess.send({ command: 'register', whoAmI: id, transports: this.transports });

    logger.info('[Controller]', `Worker ${id} created`);

    // Track the state of the worker
    workerProcess.on('message', function(message) {
      switch (message.command) {
        case 'register':
          logger.info('[Controller]', 'Worker', workerProcess.whoAmI, 'registered');
          break;
        case 'available':
          logger.info('[Controller]', 'Worker', workerProcess.whoAmI, 'available');
          workerProcess.available = true;
          break;
        case 'done':
          logger.info('[Controller]', 'Worker', workerProcess.whoAmI, 'done');
          workerProcess.available = true;
          clearTimeout(workerProcess.deadLockTimeout);
          break;
        case 'failed':
          logger.info('[Controller]', 'Worker', workerProcess.whoAmI, 'failed');
          workerProcess.available = true;
          clearTimeout(workerProcess.deadLockTimeout);
          break;
        case 'ping':
          // logger.info('[Controller]', 'Worker', workerProcess.whoAmI, 'pinged Controller');
          workerProcess.crashed = false;
          break;
      }
    });

    workerProcess.on('close', function(code, signal) {
      workerProcess.available = false;
      logger.info('[Controller]', 'Worker', workerProcess.whoAmI, 'closed');
    });

    workerProcess.on('exit', function(code, signal) {
      workerProcess.available = false;
      logger.info('[Controller]', 'Worker', workerProcess.whoAmI, 'exited');
    });

    workerProcess.pingInterval = setInterval(() => {
      if (workerProcess.crashed) {
        this.restartWorker(workerProcess);
      } else {
        workerProcess.crashed = true;
        workerProcess.send({ command: 'ping' });
      }
    }, CHECK_THROTTLE);

    return workerProcess;
  }

  setup() {
    // Launch workers on its child processes
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = this.createWorker(i);
      this.workers[i] = worker;
    }
  }

  /**
   * Wait's for a worker to become available and then returns that worker.
   * @returns {Promise}
   */
  getNextAvailableWorker() {
    const check = resolve => {
      for (const workerId of Object.keys(this.workers)) {
        const worker = this.workers[workerId];
        if (worker.available) {
          worker.available = false;
          resolve(worker);
          return;
        }
      }

      setTimeout(() => check(resolve), THROTTLE);
    };

    return new Promise(resolve => check(resolve));
  }

  /**
   * Start this controller
   *
   * Requires an async function called getData to be passed in.
   * This function gets the next set of data to be processed and passes it to a worker process.
   * If there is no data available this function should wait until there is data available to respond.
   *
   * @param getData
   * @returns {Promise.<void>}
   */
  async run({ getData }) {
    let data;

    while ((data = await getData(this)) && this.live) {
      logger.info('[Controller] got data to process', data);
      const worker = await this.getNextAvailableWorker();

      worker.deadLockTimeout = setTimeout(() => {
        this.restartWorker(worker);
      }, DEADLOCK_THROTTLE);

      worker.send({
        command: 'data',
        data: data
      });
    }

    // Kill all the workers
    logger.info('[Controller] killing all the workers and commiting suicide');
    Object.keys(this.workers).forEach((workerId) => {
      this.killWorker(this.workers[workerId]);
    });
  }

  kill() {
    this.live = false;
  }
};
