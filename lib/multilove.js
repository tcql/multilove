'use strict';

var fork = require('child_process').fork,
  binarysplit = require('binary-split'),
  path = require('path'),
  xtend = require('xtend'),
  through2 = require('through2');

var cpus = require('os').cpus().length;

module.exports = function (opts) {
  var options = xtend({
    worker: path.join(__dirname, 'worker.js'),
    workers: cpus,
    outputStream: process.stdout,
    errorStream: process.stderr,
    batchSize: 1
  }, opts);

  var stream = through2.obj(processData, flush)
    .on('end', destroy);

  stream.workers = initializeWorkers(options, stream);

  function processData(chunk, enc, done) {
    var w = lowestQueue(stream.workers);
    var worker = stream.workers[w];

    if (!worker.ready) {
      return worker.once('message', function () {
        sendToWorker(worker, stream, chunk);
        done();
      });
    }

    if (worker.queue > options.queueSize) return setImmediate(processData, chunk, enc, done);
    sendToWorker(worker, stream, chunk);
    done();
  }

  function flush(cb) {
    // If workers aren't done, keep deferring until they're finished.
    for (var i = 0; i < stream.workers.length; i++) {
      if (stream.workers[i].queue !== 0) return setImmediate(flush, cb);
    }
    return cb();
  }

  function destroy() {
    stream.destroy();
    while (stream.workers.length) stream.workers.pop().kill();
  }

  return stream;
};

/**
 * Process messages from a worker
 *
 * @method     receiveFromWorker
 * @param      {Object}  worker   { a worker }
 * @param      {Stream}  stream   { the multilove transform stream }
 * @param      {Object}  message  { a message sent back by the worker }
 */
function receiveFromWorker(worker, stream, message) {
  switch (message.type) {
    case 'ready':
      worker.ready = true;
      break;
    case 'push':
      stream.push(message.msg);
      break;
    case 'done':
      worker.queue--;
      if (message.msg) stream.push(message.msg);
      break;
    case 'error':
      stream.emit('error', message.msg);
      break;
  }
}

/**
 * Sends a chunk of work to the supplied `worker` and handles
 * the result of messages.
 *
 * @method     sendToWorker
 * @param      {ChildProcess} worker  { worker to send work to and await data from }
 * @param      {Stream}       stream  { the transform stream to write pushed data to }
 * @param      {Object}       chunk   { the chunk to push to the worker for processing }
 */
function sendToWorker(worker, stream, chunk) {
  // workers have to send back a ready signal before we start
  // writing data to them. So we'll wait for that and let the stream
  // back up a bit until it's ready.
  worker.queue++;
  worker.send(chunk);
}

/**
 * Finds id of the worker with the lowest queuesize
 *
 * @method     lowestQueue
 * @param      {Array}  workers  {list of workers}
 * @return     {number}  {id of the worker with smallest queue}
 */
function lowestQueue(workers) {
  var least = Infinity;
  var leastId = null;
  for (var i = 0; i < workers.length; i++) {
    if (workers[i].queue === 0) return i;

    if (workers[i].queue < least) {
      least = workers[i].queue;
      leastId = i;
    }
  }
  return leastId;
}

function addWorker(workers, stream, options) {
  console.error('Adding worker', workers.length);
  // Core Options that are serialized to send to the worker.
  var coreOptions = JSON.stringify({
    worker: path.resolve(options.worker),
    id: workers.length
  });

  // User Options that are serialized, which may be used
  // by custom workers
  var userOptions = JSON.stringify(xtend({}, options.workerOptions));

  var worker = fork(path.join(__dirname, 'work-handler.js'), [coreOptions, userOptions], {silent: true});
  worker.id = workers.length;
  worker.ready = false;
  worker.queue = 0;
  worker.stdout.pipe(binarysplit('\x1e')).pipe(options.outputStream);
  worker.stderr.pipe(binarysplit('\x1e')).pipe(options.errorStream);
  worker.on('message', function (message) {
    receiveFromWorker(worker, stream, message);
  });
  workers.push(worker);
  return worker;
}

/**
 * Spin up workers equal to `maxWorkers`
 *
 * @method     initializeWorkers
 * @param      {Object}  options { configuration object}
 * @param      {Stream}  stream  { the multilove transform stream }
 * @return     {Array}   array of worker processes
 */
function initializeWorkers(options, stream) {
  var workers = [];
  var maxWorkers = Math.min(options.workers || Infinity, cpus);
  options.outputStream.setMaxListeners(0);
  options.errorStream.setMaxListeners(0);

  for (var i = 0; i < maxWorkers; i++) addWorker(workers, stream, options);
  return workers;
}
