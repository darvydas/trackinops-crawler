// initialize RabbitMQ connection
const Queue = require("./rabbitmq");
// create Exchange, Queue, Binding for Trackinops reQueue
Queue.initTopology().then(function () {
  // initialize workers
  Queue.startCrawlerSubscriptions();
  // Queue.publishCrawlerRequest('http://www.b-a.eu/', 'http://www.b-a.eu/', { crawlerCustomId: 'test_crawler22', _id: 'any' })
});