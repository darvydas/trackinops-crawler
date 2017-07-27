// initialize NSQ connection
const Queue = require("./nsq");
// initialize workers
Queue.startCrawlerSubscriptions();
