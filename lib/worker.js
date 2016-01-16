'use strict';


var base = {
  _install: function (bus, coreOptions, userOptions) {
    var worker = this;
    worker.coreOptions = coreOptions;
    worker.userOptions = userOptions;
    worker.bus = bus;

    worker.initialize(function () {
      worker.bus.send({type: 'ready'});
    });

    worker.bus.on('message', worker.callMap);
  },

  /**
   * Extend allows you to overwrite methods in order to implement custom work handlers
   *
   * @method     extend
   * @param      Object  child  object containing custom work handler methods
   * @return     {<type>}  { description_of_the_return_value }
   */
  extend: function (child) {
    Object.keys(base).forEach(function (key) {
      if (!child[key]) {
        child[key] = base[key];
        if (typeof base[key] === 'function') child[key] = base[key].bind(child);
      }
    });

    return child;
  },

  /**
   * Stub map function to be overriden by custom workers. This is where the
   * actual "work" should be done. Receives data passed my a message from
   * the main multilove process. Must call `worker.done()` when finished.
   *
   * @method     map
   * @param      {<type>}  data    { description }
   * @param      {<type>}  worker  { description }
   */
  map: function (data, w) {
    w.done();
  },

  /**
   * Stub to be overridden by custom workrs, which allows them to run async
   * initialization code before signalling that the worker is ready to receive data.
   *
   * @method     initialize
   * @param      {Function}  ready   { description }
   */
  initialize: function (ready) {
    ready();
  },

  callMap: function (data) {
    var self = this;

    try {
      self.map(data, self);
    } catch (e) {
      self.bus.send({type: 'error', msg: e});
    }
  },

  push: function (data) {
    this.bus.send({type: 'push', msg: data});
  },

  done: function (error, data) {
    if (error) {
      this.bus.send({type: 'error', msg: error});
    } else {
      this.bus.send({type: 'done', msg: data});
    }
  }
};


module.exports = base;
