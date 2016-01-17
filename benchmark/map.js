
module.exports = function (data, worker) {
  setTimeout(function () {
    worker.push(data);
    worker.done();
  }, 100);
}
