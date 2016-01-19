'use strict';

var test = require('tap').test,
  multilove = require('../lib/multilove');

var cpus = require('os').cpus().length;

test('multilove -- creates worker for each cpu', function (t) {
  var stream = multilove({});
  t.equal(stream.workers.length, cpus, 'creates workers equal to number of cpus');
  stream.emit('end');
  t.end();
});

test('multilove -- number of workers can be manually set', function (t) {
  var stream = multilove({workers: 1});
  t.equal(stream.workers.length, 1, 'limits workers to specified number');
  stream.emit('end');
  t.end();
});
