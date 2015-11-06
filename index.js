var through2 = require('through2');
var util = require('util');
var streams = require('streams');
var EventEmitter = require('events');

util.inherits(Multilove, streams.Transform);

function Multilove(options, writeStreams) {  
  var self = this;

  options.objectMode = true;
  streams.Writable.call(this, options);

  this.readable = through2.obj(function (chunk, enc, done) {
    done(null, chunk);
  });

  this.writeNext = 0;
  this.locked = false;
  this.writeStates = [];
  this.writeStreams = writeStreams;

  // Initialize all writers as ready
  for (var i = 0; i < this.writeStreams.length; i++) {
    this.writeStates.push(true);
  }
}

// We don't pipe directly, use our readable stream
Multilove.prototype.pipe = function (stream) {
  return this.readable.pipe(stream);
}


Multilove.prototype.findWritable = function(wanted) {
  for (var i = wanted; i < this.writeStreams.length + wanted; i++) {
    if (this.writeStates[i % this.writeStreams.length] === true) 
      return i % this.writeStreams.length;
  }
  return false;
};


Multilove.prototype._write = function(chunk, encoding, done) {
  var self = this;
  var writeId = this.findWritable(this.writeNext);

  if (writeId === false) {
    this.locked = true;
    
    // If nothing is free, wait for the next free writeable
    this.once('child-writable', function () {
      self.locked = false; 
      self._write(chunk, enc, done); 
      self.emit('written'); // todo: get rid of this
    });
  } else {
    var status = this.writeStreams[writeId].write(chunk);
        
    if (status === false) {
      this.writeStates[writeId] = false;

      this.writeStreams[writeId].once('drain', function () {
        self.writeStates[writeId] = true;
        self.emit('child-writable', writeId); // notify that at least one child is writable
      });
    }   
    writeNext = (writeId + 1) % writestreams.length;
    done();
  }
};

Multilove.prototype._read = function (size) {

};


module.exports = function(writestreams, readstreams, options) {
  var writeStates = [];
  var writeNext = 0;
  var locked = false;


  var 


  // All streams are ready for writing
  for (var i = 0; i < writestreams.length; i++) {
    writeStates.push(true)
  }

  var transformer = through2(function (chunk, enc, done) {
      var writeId = findWritable(writeNext);
      if (writeId === false) {
        locked = true;
        // If nothing is free, wait for the next free writeable
        this.once('child-writable', function () {
          locked = false; 
          transformer._transform(chunk, enc, done); 
          transformer.emit('written');
        });
      } else {
        var status = writestreams[writeId].write(chunk);
        
        if (status === false) {
          writeStates[writeId] = false;

          writestreams[writeId].once('drain', function () {
            writeStates[writeId] = true;
            transformer.emit('child-writable', writeId); // notify that at least one child is writable
          });
        }

        writeNext = (writeId + 1) % writestreams.length;
        done();
      }
    },
    function (callback) {
      console.log("lockstate?", locked);
      if (locked === true) {
        this.once('written', callback);
      } else {
        callback();
      }
    }
  );


  function findWritable(wanted) {
    for (var i = wanted; i < writestreams.length + wanted; i++) {
      if (writeStates[i % writestreams.length] === true) return i % writestreams.length;
    }
    return false;
  }

  return transformer;
}