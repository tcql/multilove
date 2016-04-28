'use strict';

var isOldNode = process.versions.node.split('.')[0] < 4;
var queue = require('d3-queue').queue;

function Worker(map) {
  this.map = map;
  if (!map) this.map = function (data, enc, done) { done(); };
  this.mapQueue = queue(1);
  this.messageQueue = queue(1);
}

Worker.prototype._install = function (bus, coreOptions, userOptions) {
  var worker = this;
  worker.coreOptions = coreOptions;
  worker.userOptions = userOptions;
  worker.bus = bus;

  worker.initialize(function () {
    worker.bus.send({type: 'ready'}, function () {});
  });

  var mapFn = worker.callMap.bind(worker);

  // no backpressure here, so this is potentially kinda iffy.
  // Whether this is an issue will depend on whether the main
  // process sets reasonable queueSize, how big each data chunk
  // is, and how much memory is available.
  worker.bus.on('message', function (message) {
    worker.mapQueue.defer(mapFn, message);
  });
};

/**
 * Sends an error message through the bus
 *
 * @method     _sendError
 * @param      {string|Error}  error   { error message to send to the main process }
 */
Worker.prototype._formatError = function (error) {
  return {type: 'error', msg: {message: error.toString(), stack: error.stack}};
};

/**
 * Stub to be overridden by custom workrs, which allows them to run async
 * initialization code before signalling that the worker is ready to receive data.
 *
 * @method     initialize
 * @param      {Function}  ready   { callback when worker is initialized }
 */
Worker.prototype.initialize = function (ready) {
  ready();
};

/**
 * Calls the map function with the specified data
 *
 * @method     callMap
 * @param      {Array}  data    { data to be manipulated by map function }
 */
Worker.prototype.callMap = function (data, done) {
  var self = this;
  var enc = 'utf8'; // todo; actually get encoding from message metadata?

  try {
    self.map.apply(this, [data, enc, function (err, dt) {
      self.done(err, dt, done);
    }]);
  } catch (e) {
    self.done(e, null, done);
  }
};

/**
 * Write data back to the main process. This will then be pushed
 * into the readable stream
 *
 * @method     push
 * @param      {Any}  data    { data to send back to the main process }
 */
Worker.prototype.push = function (data) {
  this._queueMessage({type: 'push', msg: data});
};

Worker.prototype._queueMessage = function (message, callback) {
  var self = this;
  this.messageQueue.defer(function (message, callback, done) {
    var cb = function () {
      if (callback) callback();
      done();
    };

    self.bus.send(message, cb);
    if (isOldNode) cb();
  }, message, callback);
};

/**
 * Once `map` has completed work, it must call `done`. This signals
 * to the main process that the work was completed and this worker
 * is free to receive the next chunk of work.
 *
 * @method     done
 * @param      {string|Error|null}  error   { error message, if any, to send back to main process }
 * @param      {Any}                data    { data to send back to the main process }
 */
Worker.prototype.done = function (error, data, callback) {
  if (error) return this._queueMessage(this._formatError(error), callback);
  this._queueMessage({type: 'done', msg: data}, callback);
};

module.exports = function (mapFn) {
  return new Worker(mapFn);
};

module.exports.Worker = Worker;
