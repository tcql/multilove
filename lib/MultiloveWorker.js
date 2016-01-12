
function MultiloveWorker (bus, coreOptions, userOptions) {
  var self = this;
  this.coreOptions = coreOptions;
  this.userOptions = userOptions;

  global.worker = this;

  this.map = require(this.coreOptions.map);
  this.bus = bus;

  this.initialize(function () {
    self.bus.send({type: 'ready'});
  });

  this.bus.on('message', this.callMap.bind(this));
};

MultiloveWorker.prototype.initialize = function (ready) {
  ready();
};

MultiloveWorker.prototype.callMap = function (data) {
  return this.map(data, this.push.bind(this), this.mapCallback.bind(this));
};

MultiloveWorker.prototype.push = function (data) {
  this.bus.send({type: 'push', msg: data});
};

MultiloveWorker.prototype.mapCallback = function (error, data) {
  if (error) {
    this.bus.send({type: 'error', msg: error});
  } else {
    this.bus.send({type: 'done', msg: data});
  }
};

module.exports = MultiloveWorker;
