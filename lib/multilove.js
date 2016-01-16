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

  var maxWorkers = Math.min(options.workers || Infinity, cpus);
  var workers = initializeWorkers(options, maxWorkers);
  var started = false;

  var firstFree = function () {
    for (var i = 0; i < workers.length; i++) {
      if (workers[i].free === true) return i;
    }
    return -1;
  };

  var stream = par(maxWorkers, function (chunk, done) {
    if (!started) {
      started = true;
      stream.emit('start');
    }
    var w = firstFree();
    if (w < 0) throw new Error('Invalid worker states; no free workers');

    var worker = workers[w];
    worker.free = false;

    if (!worker.ready) {
      // workers have to send back a ready signal before we start
      // writing data to them. So we'll wait for that and let the stream
      // back up a bit until it's ready.
      worker.once('message', function () {
        sendToWorker(worker, stream, chunk, done);
      });
    } else {
      sendToWorker(worker, stream, chunk, done);
    }
  });

  // cleanup after it's destroyed
  stream.on('finish', function () {
    stream.destroy();
    while (workers.length) workers.pop().kill();
  });

  stream.options = options;
  stream.workers = workers;

  return stream;
};

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

function initializeWorkers(options, maxWorkers) {
  var workers = [];

  options.outputStream.setMaxListeners(0);
  options.errorStream.setMaxListeners(0);

  // Core Options that are serialized to send to the worker.
  var coreOptions = JSON.stringify({
    worker: path.resolve(options.worker)
  });

  // User Options that are serialized, which may be used
  // by custom work-handlers
  var userOptions = JSON.stringify(xtend({}, options.workerOptions));

  for (var i = 0; i < maxWorkers; i++) {
    var worker = fork(path.join(__dirname, 'work-handler.js'), [coreOptions, userOptions], {silent: true});
    worker.ready = false;
    worker.free = true;
    worker.stdout.pipe(binarysplit('\x1e')).pipe(options.outputStream);
    worker.stderr.pipe(options.errorStream);
    worker.once('message', function () { this.ready = true; });
    workers.push(worker);
  }
  return workers;
}
