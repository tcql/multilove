var par = require('parallel-transform'),
  fork = require('child_process').fork,
  path = require('path'),
  cpus = require('os').cpus().length,
  binarysplit = require('binary-split'),
  xtend = require('xtend')

module.exports = function (opts) {
  var options = xtend({
    worker: path.join(__dirname, 'lib/MultiloveWorker.js'),
    workers: cpus,
    outputStream: process.stdout,
    errorStream: process.stderr
  }, opts);

  var workers = [];
  var maxWorkers = Math.min(options.workers, cpus);
  var ready = 0;

  options.outputStream.setMaxListeners(0);
  options.errorStream.setMaxListeners(0);

  for (var i = 0; i < maxWorkers; i++) {
    var worker = fork(path.join(__dirname, 'lib/worker.js'),[path.resolve(options.worker), path.resolve(options.map)], {silent: true});
    worker.ready = false;
    worker.free = true;
    worker.stdout.pipe(binarysplit('\x1e')).pipe(options.outputStream);
    worker.stderr.pipe(options.errorStream);
    worker.once('message', function() { this.ready = true; });
    workers.push(worker);
  }

  var firstFree = function() {
    for (var i = 0; i < workers.length; i++) {
      if (workers[i].free == true) return i;
    }
    return -1;
  };

  var sendToWorker = function (worker, stream, chunk, done) {
    worker.once('message', function (message) {
      worker.free = true;
      stream.emit('reduce', message, chunk);
      done();
    });
    worker.send(chunk);
  };

  var stream = par(maxWorkers, function (chunk, done) {
    var w = firstFree();
    if (w < 0) {
      // This shouldn't happen unless there's a serious internal bug
      console.error(JSON.stringify(workers.map(function (ww, ind) {
        return {worker: ind, ready: ww.ready, free: ww.free};
      })));
      throw new Error("Invalid worker states; no free worker!");
    }

    var worker = workers[w];
    worker.free = false;

    if (!worker.ready) {
      // workers have to send back a ready signal before we start
      // writing data to them. So we'll wait for that and let the stream
      // back up a bit until it's ready.
      worker.once('message', function () {
        stream.emit('map', chunk);
        sendToWorker(worker, stream, chunk, done);
      });
    } else {
      sendToWorker(worker, stream, chunk, done);
    }
  });

  return stream;
};
