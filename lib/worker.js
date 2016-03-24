'use strict';


var base = {
  _install: function (bus, coreOptions, userOptions) {
    var worker = this;
    worker.coreOptions = coreOptions;
    worker.userOptions = userOptions;
    worker.bus = bus;

    worker.initialize(function () {
      worker.bus.send({type: 'ready'});
    });

    worker.bus.on('message', worker.callMap);
  },

  /**
   * Extend allows you to overwrite methods in order to implement custom work handlers
   *
   * @method     extend
   * @param      {Object}  child  object containing custom work handler methods
   * @return     {Object} new custom handler
   */
  extend: function (child) {
    Object.keys(base).forEach(function (key) {
      if (!child[key]) {
        child[key] = base[key];
        if (typeof base[key] === 'function') child[key] = base[key].bind(child);
      }
    });

    return child;
  },

  /**
   * Stub map function to be overriden by custom workers. This is where the
   * actual "work" should be done. Receives data passed my a message from
   * the main multilove process. Must call `worker.done()` when finished.
   *
   * @method     map
   * @param      {Array}  data    data to manipulated
   * @param      {Object}  worker
   */
  map: function (data, w) {
    w.done();
  },

  /**
   * Stub to be overridden by custom workrs, which allows them to run async
   * initialization code before signalling that the worker is ready to receive data.
   *
   * @method     initialize
   * @param      {Function}  ready   callback when worker is initialized
   */
  initialize: function (ready) {
    ready();
  },

  /**
   * Calls the map function with the specified data
   *
   * @method     callMap
   * @param      {Array}  data    data to be manipulated by map function
   */
  callMap: function (data) {
    var self = this;

    try {
      self.map(data, self);
    } catch (error) {
      self._sendError(error);
    }
  },

  /**
   * Write data back to the main process. This will then be pushed
   * into the readable stream
   *
   * @method     push
   * @param      {Any}  data    data to send back to the main process
   */
  push: function (data) {
    this.bus.send({type: 'push', msg: data});
  },

  /**
   * Sends an error message through the bus
   *
   * @method     _sendError
   * @param      {string|Error}  error   error message to send to the main process
   */
  _sendError: function (error) {
    this.bus.send({type: 'error', msg: {message: error.toString(), stack: error.stack}});
  },

  /**
   * Once `map` has completed work, it must call `done`. This signals
   * to the main process that the work was completed and this worker
   * is free to receive the next chunk of work.
   *
   * @method     done
   * @param      {string|Error|null}  error   error message, if any, to send back to main process
   * @param      {Any}  data    data to send back to the main process
   */
  done: function (error, data) {
    if (error) {
      this._sendError(error);
    } else {
      this.bus.send({type: 'done', msg: data});
    }
  }
};


module.exports = base;
