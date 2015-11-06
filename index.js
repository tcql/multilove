var through2 = require('through2');
var util = require('util');
var streams = require('stream');
var EventEmitter = require('events');

util.inherits(Multilove, streams.Writable);

function Multilove(options, writeStreams, readStreams) {  
  var self = this;
  streams.Writable.call(this, options);

  this.readable = true;

  // Super simple passthrough that we'll pipe all the writables to if 
  // we want to pipe them. If a list of readStreams was passed in, also
  // pipe them to this stream.
  this.outputStream = through2.obj(function (chunk, enc, done) {
    done(null, chunk);
  });

  this.writeStreams = writeStreams; // list of writables under our control
  this.readStreams = readStreams || []; // list of readable streams that we'll pipe to `outputStream`
  this.writeNext = 0; // the index of the writable to try writing to next
  this.locked = false; // whether or not the stream is currently locked (all writables busy)
  this.writeStates = []; // boolean status of writeStreams

  // Initialize all writers as ready
  for (var i = 0; i < this.writeStreams.length; i++) {
    this.writeStates.push(true);
    if (options.pipeWritables && this.writeStreams[i].readable) {
      this.readStreams.push(this.writeStreams[i]);
    }
  }

  // Pipe readstreams (and readable writestreams, if we opted to pipe them)
  // into the outputStream
  for (var i = 0; i < this.readStreams.length; i++) {
    this.readStreams[i].pipe(this.outputStream);
  }
}

/**
 * Pass off piping to the outputStream
 */
Multilove.prototype.pipe = function (stream) {
  return this.outputStream.pipe(stream);
}

/**
 * Pass of reading to the outputStream
 */
Multilove.prototype._read = function (size) {
  return this.outputStream._read(size);
};

/**
 * Try to get the desired writable stream. If this one is busy, 
 * try to find the next available stream. If all streams are busy,
 * return false
 */
Multilove.prototype.findWritable = function(wanted) {
  for (var i = wanted; i < this.writeStreams.length + wanted; i++) {
    if (this.writeStates[i % this.writeStreams.length] === true) {
      return i % this.writeStreams.length;
    }
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
      self._write(chunk, encoding, done); 
    });

    return false;
  } else {
    // If we found a free writable, then write to it
    var status = this.writeStreams[writeId].write(chunk);
        
    // If the write returned that this writable isn't ready for
    // more data, then we disable it temporarily. Once the writable
    // emits `drain` we unlock it and emit an event
    if (status === false) {
      this.writeStates[writeId] = false;
      this.writeStreams[writeId].once('drain', function () {
        self.writeStates[writeId] = true;
        self.emit('child-writable', writeId); // notify that at least one child is writable
      });
    }   

    // cycle to the next id.
    this.writeNext = (writeId + 1) % this.writeStreams.length;
    done();

    return true;
  }
};

module.exports = Multilove;