'use strict';

var test = require('tap').test,
  worker = require('../lib/worker'),
  Emitter = require('events');

test('work-handler -- extend', function (t) {
  var custom = worker.extend({
    callMap: function () {
      return 5;
    }
  });

  t.equal(custom.callMap(), 5, 'new method overrides original');
  t.notEqual(custom.callMap, worker.callMap, 'original was not mutated');
  t.end();
});

test('work-handler -- `done` sends data messages', function (t) {
  var lastSent = null;

  var bus = {
    send: function (message) {
      lastSent = message;
    },
    on: function () {}
  };
  worker._install(bus, {}, {});

  worker.done(null, 'Success, Data');
  t.deepEqual(lastSent, {type: 'data', msg: 'Success, Data'}, 'properly sends "data" message');

  worker.done('Error Occurred', null);
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
  var custom = worker.extend({
    map: function (data, w) {
      mapCalled++;
      mappedData = data;
      w.done();
    }
  });
  var bus = new Emitter();
  bus.send = function (message) {
    if (message.type === 'doneBatch') {
      t.equal(mapCalled, 1, 'map should have been called once');
      t.equal(mappedData, '42!', 'map was passed original message that was emitted');
      t.end();
    }
  };
  custom._install(bus, {}, {});
  bus.emit('message', ['42!']);
});

test('work-handler -- on map error, error message is sent via bus', function (t) {
  var e = new Error('This is the error message');
  var custom = worker.extend({
    map: function () {
      throw e;
    }
  });

  var bus = new Emitter();
  bus.send = function (message) {
    if (message.type === 'error') {
      t.deepEqual({type: 'error', msg: {message: e.toString(), stack: e.stack}}, message, 'proper error message is propagated to bus');
      t.end();
    }
  };

  custom._install(bus, {}, {});
  custom.callMap(['some data']);
});

test('work-handler -- push sends push data via bus', function (t) {
  var pushes = [];
  var custom = worker.extend({
    map: function (data, w) {
      w.push(1);
      w.push({value: 2});
      w.done();
    }
  });

  var bus = new Emitter();
  bus.send = function (message) {
    if (message.type === 'push') {
      pushes.push(message);
    }
    if (message.type === 'data') {
      t.equal(pushes.length, 2, 'two items were pushed');
      t.deepEqual([
        {type: 'push', msg: 1},
        {type: 'push', msg: {value: 2}}
      ], pushes, 'the correct items were pushed');
    }
    if (message.type === 'doneBatch') {
      t.end();
    }
  };

  custom._install(bus, {}, {});
  custom.callMap(['some data']);
});
