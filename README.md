### What is it?

`multilove` is a transform stream that lets you map work across child processes and stream out results.

##### When would you use it?

When you're doing heavy processing as a transform in a stream, and you end up wasting a lot of time waiting for individual stream chunks to be processed.

### Usage

#### Setup
**Main process**

```js
// index.js
var multilove = require('multilove');

var stream = multilove({
  worker: __dirname+'/map.js'
});

for (var i = 0; i < 100000; i++) {
  stream.write(i);
}

stream.on('data', function (data) {
  console.log(data);
});
```

**Worker**

```js
// map.js
module.exports = function (data, worker) {
  var result = // Do some work with the data
  worker.push(result); // Will send results back to the main multilove stream.
                       // `push` can be called multiple times.

  worker.done();
}

```

#### Options

- `worker` - path to worker
- `workers` - number of workers to spawn. Defaults to `require('os').cpus().length`
- `outputStream` - stream to output `console.log` data from workers to. Defaults to  `process.stdout`
- `errorStream` - stream to output `console.error` data from workers to. Defaults to `process.stderr`
- `batchSize` - number of records to send concurrently to each worker. Defaults to `1`


#### Extending the worker

If your worker has to do additional work, such as initializing database connections before the map function can be called, you can extend the multilove worker object in your `map` script:

```js
// map.js
var base = require('multilove/lib/worker');

module.exports = base.extend({
  // Work that is executed once when the worker is first initialized
  initialize: function (ready) {
    something.async(function (err) {
      if (err) throw err;
      ready();
    });
  },

  // the function that will be executed on each piece of data
  map: function (data, worker) {
    var result = // Do some work with the data
    worker.push(result); // Will send results back to the main multilove stream.
                         // `push` can be called multiple times.

    worker.done();
  }
});
```

