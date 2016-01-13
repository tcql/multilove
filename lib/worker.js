'use strict';

var xtend = require('xtend');

var worker = {
  _install: function (bus, coreOptions, userOptions) {
    var self = this;

    this.coreOptions = coreOptions;
    this.userOptions = userOptions;
    this.bus = bus;

    this.initialize(function () {
      self.bus.send({type: 'ready'});
    });

    this.bus.on('message', this.callMap.bind(this));
  },

  /**
   * Extend allows you to overwrite methods in order to implement custom work handlers
   *
   * @method     extend
   * @param      Object  child  object containing custom work handler methods
   * @return     {<type>}  { description_of_the_return_value }
   */
  extend: function (child) {
    return xtend(worker, child);
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
  map: function (data, worker) {
    worker.done();
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
    try {
      this.map(data, this);
    } catch (e) {
      this.bus.send({type: 'error', msg: e});
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


module.exports = worker;
