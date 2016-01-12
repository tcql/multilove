var coreOptions = JSON.parse(process.argv[2]);
var userOptions = JSON.parse(process.argv[3]);
var base = require(coreOptions.worker);

/* Remap console.log and console.error so we can ensure ordering in result streams */
var reallog = console.log;
var realerror = console.error;

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

console.log = function () {
  process.stdout.write(log.call(log, arguments));
  process.stdout.write('\x1e');
};
console.error = function () {
  process.stderr.write(log.call(log, arguments));
  process.stderr.write('\x1e');
}

new base(process, coreOptions, userOptions);
