'use strict';

var queue = require('d3-queue').queue;
var coreOptions = JSON.parse(process.argv[2]);
var userOptions = JSON.parse(process.argv[3]);
var worker = require(coreOptions.worker);

// If the worker that was required doesn't extend the base worker,
// assume that it's just a standalone map function. In that case, we'll
// load the function and extend the base worker with the provided map
// function.
if (!worker._install && typeof worker === 'function') {
  worker = require('./worker')(worker);
}

function log(logArgs) {
  var args = [];
  for (var i in logArgs) {
    args.push(logArgs[i]);
  }

  var stringed = args.map(function (elem) {
    if (typeof elem !== 'string') return JSON.stringify(elem);
    return elem;
  }).join(' ');

  stringed += '\n';
  return stringed;
}

var logQueue = queue(1);
var errorQueue = queue(1);

// Remap console.log and console.error so
// we can ensure ordering in result streams
console.log = function () {
  logQueue.defer(function (args, done) {
    process.stdout.write(log.call(log, args) + '\x1e', done);
  }, arguments);
};

console.error = function () {
  errorQueue.defer(function (args, done) {
    process.stderr.write(log.call(log, args) + '\x1e', done);
  }, arguments);
};


worker._install(process, coreOptions, userOptions);
