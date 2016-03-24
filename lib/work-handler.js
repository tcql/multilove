'use strict';

var coreOptions = JSON.parse(process.argv[2]);
var userOptions = JSON.parse(process.argv[3]);
var worker = require(coreOptions.worker);

// If the worker that was required doesn't extend the base worker,
// assume that it's just a standalone map function. In that case, we'll
// load the function and extend the base worker with the provided map
// function.
if (!worker._install && typeof worker === 'function') {
  worker = require('./worker').extend({
    map: worker
  });
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

/* Remap console.log and console.error so we can ensure ordering in result streams */
console.log = function () {
  process.stdout.write(log.call(log, arguments));
  process.stdout.write('\x1e');
};

console.error = function () {
  process.stderr.write(log.call(log, arguments));
  process.stderr.write('\x1e');
};


worker._install(process, coreOptions, userOptions);
