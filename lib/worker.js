'use strict';

var through2 = require('through2');

var base = {
  _install: function (bus, coreOptions, userOptions) {
    var worker = this;
    worker.coreOptions = coreOptions;
    worker.userOptions = userOptions;
    worker.bus = bus;
    worker.awaitedDones = 0;
    worker.recievedDones = 0;

    worker.initialize(function () {
      worker.bus.send({type: 'ready'});
    });

    var mapThrough = through2.obj(worker.callMap.bind(worker));
    worker.mapThrough = mapThrough;

    worker.bus.on('message', mapThrough.write.bind(mapThrough));
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
   * the main multilove process. Must call `callback()` when finished.
   *
   * @method     map
   * @param      {Array}  data    data to manipulated
   * @param      {Object}  worker
   */
  map: function (data, w, callback) {
    callback();
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
  callMap: function (data, enc, done) {
    var self = this;
    self.map.apply(this, [data, function (err, dt) {
      done();
      self.done(err, dt);
    }]);
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
   * Once `map` has completed work, it must call `done`. This signals
   * to the main process that the work was completed and this worker
   * is free to receive the next chunk of work.
   *
   * @method     done
   * @param      {string|Error|null}  error   { error message, if any, to send back to main process }
   * @param      {Any}                data    { data to send back to the main process }
   */
  done: function (error, data) {
    if (error) this._sendError(error);
    this.bus.send({type: 'data', msg: data});
  }
};

module.exports = base;
