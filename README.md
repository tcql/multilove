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
var base = require('multilove/lib/worker');

module.exports = base.extend({
  map: function (data, worker) {
    var result = // Do some work with the data
    worker.push(result); // Will send results back to the main multilove stream.
                         // `push` can be called multiple times.
    worker.done();
  }
});
```

