
function MultiloveWorker (bus, args) {
  var self = this;
  this.options = this.mapArguments(args);
  this.map = require(this.options.map);
  this.bus = bus;

  this.initialize(function () {
    self.bus.send({type: 'ready'});
  });

  this.bus.on('message', this.callMap.bind(this));
};

MultiloveWorker.prototype.mapArguments = function (args) {
  return {map: args[0]};
};

MultiloveWorker.prototype.initialize = function (ready) {
  ready();
};

MultiloveWorker.prototype.callMap = function (data) {
  return this.map(data, this.mapCallback.bind(this));
};

MultiloveWorker.prototype.mapCallback = function (error, data) {
  if (error) {
    this.bus.send({type: 'error', msg: error});
  } else {
    this.bus.send({type: 'done', msg: data});
  }
};

module.exports = MultiloveWorker;
