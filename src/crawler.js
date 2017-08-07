// initialize NSQ connection
const NSQ = require("./nsq");

// initialize workers
NSQ.startCrawlerSubscriptions();