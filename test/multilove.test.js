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

test('multilove -- sends work in batches', function (t) {
  var stream = multilove({workers: 1, batchSize: 2});
  var called = 0;
  var batches = [];
  stream.on('map', function (dd) {
    called++;
    batches.push(dd);
  }).on('finish', function () {
    stream.emit('end');
    t.deepEqual(batches, [[0, 1], [2, 3]], 'sent expected batches');
    t.equal(called, 2, 'sent expected number of batches');
    t.end();
  });

  for (var i = 0; i < 4; i++) {
    stream.write(i);
  }
  stream.end();
});
