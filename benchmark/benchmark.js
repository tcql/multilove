var multilove = require('../');
var Benchmark = require('benchmark');
var through2 = require('through2');
var streamArray = require('stream-array');

var nums = [];
for (var i = 0; i < 10; i++) {
  nums.push(i);
}

var suite = new Benchmark.Suite('turf-buffer');
suite
  .add('timer -- naïve',function (deferred) {
    var results = [];
    streamArray(nums)
      .pipe(through2.obj(function (chunk, enc, done) {
        setTimeout(function () {
          done(null, chunk);
        }, 100);
      }))
      .on('data', function (d) {
        results.push(d);
      })
      .on('end', deferred.resolve.bind(deferred))
  }, {defer: true})
  .add('timer -- multilove', function (deferred) {
    var results = [];
    streamArray(nums)
      .pipe(multilove({
        worker: __dirname + '/map.js',
      }))
      .on('data', function (d) {
        results.push(d);
      })
      .on('finish', deferred.resolve.bind(deferred))
  }, {defer: true})
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {

  })
  .run();
