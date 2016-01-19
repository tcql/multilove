'use strict';

var par = require('parallel-transform'),
  fork = require('child_process').fork,
  path = require('path'),
  binarysplit = require('binary-split'),
  xtend = require('xtend');

var cpus = require('os').cpus().length;

module.exports = function (opts) {
  var options = xtend({
    worker: path.join(__dirname, 'worker.js'),
    workers: cpus,
    outputStream: process.stdout,
    errorStream: process.stderr
  }, opts);

  var writtenRecords = 0;
  var finishedRecords = 0;
  var maxWorkers = Math.min(options.workers || Infinity, cpus);
  var desiredWorkers = maxWorkers;
  var workers = initializeWorkers(options, maxWorkers);
  var started = false;

  var firstFree = function () {
    for (var i = 0; i < workers.length; i++) {
      if (workers[i].free === true) return i;
    }
    return -1;
  };

  var stream = par(maxWorkers, function (chunk, done) {
    writtenRecords++;
    if (!started) {
      started = true;
      stream.emit('start');
    }
    var w = firstFree();
    if (w < 0) throw new Error('Invalid worker states; no free workers');

    var worker = workers[w];
    worker.free = false;

    var complete = function () {
      finishedRecords++;
      if (desiredWorkers < workers.length) {
        // look up which worker this is; we might not have the same ID anymore
        // because another worker may have scaled down too
        var index = workers.indexOf(worker);
        workers.splice(index, 1);
        stream._maxParallel--;
      }
      done();
    };

    if (!worker.ready) {
      // workers have to send back a ready signal before we start
      // writing data to them. So we'll wait for that and let the stream
      // back up a bit until it's ready.
      worker.once('message', function () {
        sendToWorker(worker, stream, chunk, complete);
      });
    } else {
      sendToWorker(worker, stream, chunk, complete);
    }
  });


  // cleanup after it's destroyed
  stream.on('end', function () {
    stream.destroy();
    while (workers.length) workers.pop().kill();
  });

  stream.options = options;
  stream.workers = workers;
  stream.scaleWorkers = function (value) {
    desiredWorkers = Math.min(cpus, value);
    // If we're scaling up, create workers right away
    while (desiredWorkers > workers.length) {
      addWorker(workers, options);
      stream._maxParallel++;
    }
  };
  return stream;
};

/**
 * Sends a chunk of work to the supplied `worker` and handles
 * the result of messages.
 *
 * @method     sendToWorker
 * @param      {ChildProcess}    worker  worker to send work to and await data from
 * @param      {Array}     stream  the transform stream to write pushed data to
 * @param      {<type>}    chunk   the chunk to push to the worker for processing
 * @param      {Function}  done    callback when the worker has finished processing
 */
function sendToWorker(worker, stream, chunk, done) {
  stream.emit('map', chunk);
  var listener = function (message) {
    if (message.type !== 'push') {
      worker.free = true;

      if (message.type === 'done') stream.emit('reduce', message.msg, chunk);
      if (message.type === 'error') stream.emit('error', message.msg);

      worker.removeListener('message', listener);
      done();
    } else {
      stream.push(message.msg);
    }
  };

  worker.on('message', listener);
  worker.send(chunk);
}

function addWorker(workers, options) {
  console.error('Adding worker', workers.length);
  // Core Options that are serialized to send to the worker.
  var coreOptions = JSON.stringify({
    worker: path.resolve(options.worker)
  });

  // User Options that are serialized, which may be used
  // by custom work-handlers
  var userOptions = JSON.stringify(xtend({}, options.workerOptions));

  var worker = fork(path.join(__dirname, 'work-handler.js'), [coreOptions, userOptions], {silent: true});
  worker.ready = false;
  worker.free = true;
  worker.stdout.pipe(binarysplit('\x1e')).pipe(options.outputStream);
  worker.stderr.pipe(options.errorStream);
  worker.once('message', function () { this.ready = true; });
  workers.push(worker);

  return worker;
}

/**
 * Spin up workers equal to `maxWorkers`
 *
 * @method     initializeWorkers
 * @param      {Object}  options
 * @param      {number}  maxWorkers  how many workers to create
 * @return     {Array}   array of worker processes
 */
function initializeWorkers(options, maxWorkers) {
  var workers = [];

  options.outputStream.setMaxListeners(0);
  options.errorStream.setMaxListeners(0);

  for (var i = 0; i < maxWorkers; i++) addWorker(workers, options);

  return workers;
}
