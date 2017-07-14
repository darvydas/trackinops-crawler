const _ = require('lodash');
// insert configuration file
const config = require('../../configuration.js')(process.env.NODE_ENV);

module.exports = function (rabbit, MongoCrawlerDocs) {
  const settings = {};
  settings.exchanges = [];
  settings.queues = [];
  settings.bindings = [];

  // arguments used to establish a connection to a broker
  settings.connection =
    {
      name: config.rabbit.connection.name,
      user: config.rabbit.connection.username,
      pass: config.rabbit.connection.password,
      server: config.rabbit.connection.server,
      port: config.rabbit.connection.port,
      vhost: config.rabbit.connection.VHost,
      timeout: config.rabbit.connection.timeout,
      failAfter: config.rabbit.connection.failAfter,
      retryLimit: config.rabbit.connection.retryLimit
    };

  // define the exchanges
  // exchange for passing requests to crawler 
  settings.exchanges.push(
    {
      name: "trackinops.crawler-request-router",
      type: "topic",
      autoDelete: false,
      persistent: true,
      durable: true
    });
  // exchange for passing links to Parser
  settings.exchanges.push(
    {
      name: "trackinops.crawler-parser-router",
      type: "topic",
      autoDelete: false,
      persistent: true,
      durable: true
    });

  // defining queues, only subscribing to the one's this service will consume messages from

  _.each(_.keys(MongoCrawlerDocs), function (key) {
    // creating queues and bindings for all of the crawlers and parsers from MongoDB Cawlers collection
    settings.queues.push({
      name: 'Crawler.' + MongoCrawlerDocs[key].crawlerCustomId, // queue name = crawler customId
      autoDelete: false,
      subscribe: true,
      persistent: true,
      durable: true,
      noCacheKeys: true,
      limit: MongoCrawlerDocs[key].maxParallelRequests || config.rabbit.prefetchLimit // queue prefetch / parallel messages taken from queue
    });
    settings.bindings.push({
      exchange: "trackinops.crawler-request-router",
      target: 'Crawler.' + MongoCrawlerDocs[key].crawlerCustomId,
      keys: ["crawler." + MongoCrawlerDocs[key].crawlerCustomId + ".#"]
    });

    settings.queues.push({
      name: 'Parser.' + MongoCrawlerDocs[key].crawlerCustomId, // queue name = crawler customId
      autoDelete: false,
      // subscribe: true,
      persistent: true,
      durable: true,
      noCacheKeys: true,
      limit: MongoCrawlerDocs[key].maxParallelRequests || config.rabbit.prefetchLimit // queue prefetch / parallel messages taken from queue
    });
    settings.bindings.push({
      exchange: "trackinops.crawler-parser-router",
      target: 'Parser.' + MongoCrawlerDocs[key].crawlerCustomId,
      keys: ["parser." + MongoCrawlerDocs[key].crawlerCustomId + ".#"]
    });
  });
  // default all requests queue
  settings.queues.push({
    name: "all_crawler_requests",
    autoDelete: false,
    // subscribe: true,
    persistent: true,
    durable: true,
    noCacheKeys: true,
    limit: config.rabbit.prefetchLimit // queue prefetch
  });
  // binds crawler-request-router exchange and all_crawler_requests queue to one another
  settings.bindings.push({
    exchange: "trackinops.crawler-request-router",
    target: "all_crawler_requests",
    keys: ["crawler.#"]
  });

  // exchange, queue, binding for message Lists to requeue to another queues
  settings.exchanges.push(
    {
      name: "trackinops.crawler-message-router",
      type: "direct",
      autoDelete: false,
      persistent: true,
      durable: true
    });
  settings.queues.push({
    name: 'Requeue.crawler_queUrlList_requeue', // queue name 
    autoDelete: false,
    // subscribe: true,
    persistent: true,
    durable: true,
    noCacheKeys: true,
    limit: config.rabbit.requePrefetchLimit // queue prefetch / parallel messages taken from queue
  });
  settings.bindings.push({
    exchange: "trackinops.crawler-message-router",
    target: "Requeue.crawler_queUrlList_requeue",
    keys: ["Requeue.crawler_requeue"]
  });


  if (config.NODE_ENV === 'development') {
    // add console logs
    settings.logging = {
      adapters: {
        stdOut: { // adds a console logger at the "info" level
          level: config.NODE_LOG_LEVEL, // 3 for info
          bailIfDebug: true
        }
      }
    }
  }

  return rabbit.configure(settings).then(null, function (err) {
    console.error('Could not connect or configure RabbitMQ:', err);
  });
};
