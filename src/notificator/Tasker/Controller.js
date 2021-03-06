const cp = require('child_process');
const EventEmitter = require('events');
const logger = require('../logger');
const NUM_CPU = require('os').cpus().length;

// TODO: is taking logger from the upper folder
// TODO: should we wait on the setup function until all workers are registered?
// TODO: timeouts and intervals are not cleared always correctly
// TODO: Exit handling is not working, Test changing the controller.script to something else
// TODO: kill() will kill active workers, create an stop method that waits for active workers to finish
// TODO: Validate config parameters`

module.exports = class Controller extends EventEmitter {
  constructor({
    maxWorkers = NUM_CPU,
    script,
    workerPingInterval,
    getNextWorkerPollInterval,
    workerDeadlockTimeout
  }) {
    super();
    this.workers = [];
    this.maxWorkers = maxWorkers;
    this.script = script;
    this.live = true;
    this.isSetup = false;
    this.workerPingInterval = workerPingInterval;
    this.getNextWorkerPollInterval = getNextWorkerPollInterval;
    this.workerDeadlockTimeout = workerDeadlockTimeout;
  }

  restartWorker(workerProcess) {
    const id = workerProcess.whoAmI;
    logger.warn('[Crl] restarting worker with id', id);
    this.killWorker(workerProcess);

    this.workers[id] = this.createWorker(id);
  }

  killWorker(workerProcess) {
    clearInterval(workerProcess.pingInterval);
    clearTimeout(workerProcess.deadLockTimeout);
    workerProcess.kill();
  }

  createWorker(id) {
    // logger.info('[Crl]', `creating worker ${id}`);

    const workerProcess = cp.fork(this.script);

    // Initial tracking state for worker
    workerProcess.whoAmI = id;
    workerProcess.available = false; // Track if worker is bussy
    workerProcess.crashed = false; // Track if responds to pings

    // Let the worker know which ID it is.
    workerProcess.send({ command: 'register', whoAmI: id });

    // Track the state of the worker
    workerProcess.on('message', message => {
      switch (message.command) {
        case 'register':
          logger.debug('[Crl]', 'Worker', workerProcess.whoAmI, 'registered');
          break;
        case 'available':
          logger.debug('[Crl]', 'Worker', workerProcess.whoAmI, 'available');
          workerProcess.available = true;
          break;
        case 'done':
          logger.debug('[Crl]', 'Task Done Worker', workerProcess.whoAmI, 'done');
          workerProcess.available = true;
          clearTimeout(workerProcess.deadLockTimeout);
          this.emit('done');
          break;
        case 'failed':
          logger.info('[Crl]', 'Worker', workerProcess.whoAmI, 'failed');
          workerProcess.available = true;
          clearTimeout(workerProcess.deadLockTimeout);
          break;
        case 'ping':
          workerProcess.crashed = false;
          break;
      }
    });

    // TODO: In theory when there is no error event it will be thrown?
    workerProcess.on('error', error => {
      workerProcess.available = false;
      logger.error('[Crl] worker', workerProcess.whoAmI);
      logger.error(error);
    });

    workerProcess.on('close', (code, signal) => {
      workerProcess.available = false;
      logger.info('[Crl]', 'Worker', workerProcess.whoAmI, 'closed');
    });

    workerProcess.on('exit', (code, signal) => {
      workerProcess.available = false;
      logger.info(
        `[Crl] Worker ${workerProcess.whoAmI} exited with code: ${code}, signal: ${signal}`
      );
    });

    workerProcess.pingInterval = setInterval(() => {
      logger.info('[Crl]', 'Setting worker', workerProcess.whoAmI, 'ping inverval', this.workerPingInterval);
      if (workerProcess.crashed) {
        logger.warn('[Crl] worker', workerProcess.whoAmI, 'ping timeout');
        this.restartWorker(workerProcess);
      } else {
        workerProcess.crashed = true;
        workerProcess.send({ command: 'ping' });
      }
    }, this.workerPingInterval);

    return workerProcess;
  }

  launchWorkers() {
    // Launch workers on its child processes
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = this.createWorker(i);
      this.workers[i] = worker;
    }

    this.isSetup = true;
  }

  /**
   * Wait's for a worker to become available and then returns that worker.
   * @returns {Promise}
   */
  getNextAvailableWorker() {
    const check = resolve => {
      for (let worker of this.workers) {
        if (worker.available) {
          worker.available = false;
          resolve(worker);
          return;
        }
      }

      setTimeout(() => check(resolve), this.getNextWorkerPollInterval);
    };

    return new Promise(resolve => check(resolve));
  }

  /**
   * Overridable async function
   * This function gets the next set of data to be processed and passes it to a worker process.
   * If there is no data available this function should wait until there is data available to respond
   * Use controller.live to stop polling tasks and return null in promise, this allows the controller to stop itself when requrired
   * @param controller
   * @returns {Promise.<boolean>}
   */
  async getData() {
    throw new Error(
      'Please override getData function on Controller class or send it on run()'
    );
  }

  /**
   * Start this controller
   *
   * @returns {Promise.<void>}
   */
  async run({ getData } = {}) {
    if (!this.isSetup) {
      throw new Error('please call controller.setup() before run');
    }

    const getNextTask = getData || this.getData;

    let data;
    while (this.live) {
      logger.info('[Crl] starting pull cycle');
      data = await getNextTask(this);

      logger.info('[Crl] got data to process');
      const worker = await this.getNextAvailableWorker();

      worker.deadLockTimeout = setTimeout(() => {
        this.restartWorker(worker);
      }, this.workerDeadlockTimeout);

      worker.send({
        command: 'data',
        data: data
      });
    }

    // Kill all the workers
    logger.info('[Crl] killing all the workers and commiting suicide');
    this.workers.forEach(worker => {
      this.killWorker(worker);
    });
  }

  kill() {
    this.live = false;
  }
};
