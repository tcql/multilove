'use strict';

var test = require('tap').test,
  worker = require('../lib/worker'),
  Emitter = require('events');

var isOldNode = process.versions.node.split('.')[0] < 4;

test('work-handler -- `done` sends done messages', function (t) {
  var w = worker();

  var lastSent = null;

  var bus = {
    send: function (message, cb) {
      lastSent = message;
      if (!isOldNode) cb();
    },
    on: function () {}
  };
  w._install(bus, {}, {});

  w.done(null, 'Success, Data', function () {});
  t.deepEqual(lastSent, {type: 'done', msg: 'Success, Data'}, 'properly sends "data" message');

  w.done('Error Occurred', null, function () {});
  t.deepEqual(lastSent, {
    type: 'error',
    msg: {
      message: 'Error Occurred',
      stack: null
    }
  }, 'properly sends "error" message');
  t.end();
});

test('work-handler -- on message, map is called', function (t) {
  var mapCalled = 0;
  var mappedData = null;
  var custom = worker(function (data, enc, done) {
    mapCalled++;
    mappedData = data;
    done();
  });

  var bus = new Emitter();
  bus.send = function (message, cb) {
    if (message.type === 'done') {
      t.equal(mapCalled, 1, 'map should have been called once');
      t.equal(mappedData, '42!', 'map was passed original message that was emitted');
      t.end();
    }
    if (!isOldNode) cb();
  };
  custom._install(bus, {}, {});
  bus.emit('message', '42!');
});

test('work-handler -- on map error, error message is sent via bus', function (t) {
  var e = new Error('This is the error message');
  var custom = worker(function () {
    throw e;
  });

  var bus = new Emitter();
  bus.send = function (message, cb) {
    if (message.type === 'error') {
      t.deepEqual({type: 'error', msg: {message: e.toString(), stack: e.stack}}, message, 'proper error message is propagated to bus');
      if (!isOldNode) cb();
      t.end();
    }
  };

  custom._install(bus, {}, {});
  custom.callMap('some data');
});

test('work-handler -- push sends push data via bus', function (t) {
  var pushes = [];
  var custom = worker(function (data, enc, done) {
    this.push(1);
    this.push({value: 2});
    done();
  });

  var bus = new Emitter();
  bus.send = function (message, cb) {
    if (message.type === 'push') {
      pushes.push(message);
    }
    if (message.type === 'done') {
      t.deepEqual([
        {type: 'push', msg: 1},
        {type: 'push', msg: {value: 2}}
      ], pushes, 'the correct items were pushed');
      t.equal(pushes.length, 2, 'two items were pushed');
      t.end();
    }
    if (!isOldNode) cb();
  };

  custom._install(bus, {}, {});
  custom.callMap('some data', function () {});
});
