// insert configuration file
const config = require('../../configuration.js')(process.env.NODE_ENV);

const _ = require('lodash');
const Promise = require('bluebird');
const URL = require('url');
const URI = require('urijs');

const CDP = require('chrome-remote-interface');

const nsq = require('nsqjs');
const NSQwriter = new nsq.Writer(config.nsq.server, config.nsq.wPort);
NSQwriter.connect();
NSQwriter.on('ready', function () {
  console.info(`NSQ Writer ready on ${config.nsq.server}:${config.nsq.wPort}`);
});
NSQwriter.on('closed', function () {
  console.info('NSQ Writer closed Event');
});

const NSQreader = new nsq.Reader(process.env.readTopic || 'trackinops.crawler-request', 'Execute_request', config.nsq.readerOptions);
NSQreader.connect();
NSQreader.on('ready', function () {
  console.info(`NSQ Reader ready on nsqlookupd:${config.nsq.lookupdHTTPAddresses} or ${nsqdTCPAddresses}`);
});
NSQreader.on('error', function (err) {
  console.error(`NSQ Reader error Event`);
  console.error(new Error(err));
});
NSQreader.on('closed', function () {
  console.info('NSQ Reader closed Event');
});

process.on('SIGINT', function () {
  console.info("\nStarting shutting down from SIGINT (Ctrl-C)");
  // closing NSQwriter and NSQreader connections
  NSQwriter.close();
  NSQreader.close();

  // Closing all Chromium Tabs
  CDP.List(function (err, targets) {
    if (!err) {
      // console.log(targets);
      if (targets.length !== 0) {
        _.forEach(targets, function (target, index) {
          CDP.Close({ id: target.id }, function (err) {
            if (err) return console.error(`Closing Chrome Tab have failed with ${err.message}`);
            console.info(`Chrome Tab ${index}: ${target.id} have been closed.`);
            if (index === targets.length - 1) {
              console.info("\nGracefully shutting down from SIGINT (Ctrl-C) - Completed!");
              process.exit(0);
            }
          });
        })
      } else {
        console.info("\nHaven't found any Chrome Tabs! Shutting down from SIGINT (Ctrl-C)");
        process.exit(0);
      }
    } else {
      console.info("CDP ERROR", err);
      console.info("\nShutting down from SIGINT (Ctrl-C)");
      process.exit(1);
    }
  });
  // process.exit(0);
})

const publishParserRequest = function (url, uniqueUrl, executionDoc) {
  return new Promise(function (resolve, reject) {
    NSQwriter.publish("trackinops.crawler-parser", {
      url: url,
      uniqueUrl: uniqueUrl,
      executionDoc: executionDoc,
      timestamp: Date.now()
    }, function (err) {
      if (err) {
        console.error(`NSQwriter Parser Request publish Error: ${err.message}`);
        return reject(err);
      }
      console.info(`Parser Request sent to NSQ, 150 chars: ${uniqueUrl.substring(0, 150)}`);
      return resolve();
    })
  })
}

const publishMessageRequeue = function (bodyData, publishedMessageId) {
  return new Promise(function (resolve, reject) {
    if (_.isUndefined(bodyData)) { return reject(new Error('Message bodyData is undefined')) }
    // bodyData.timestamp = Date.now();
    NSQwriter.publish("trackinops.requeue-frontier", {
      publishedMessageId: publishedMessageId,
      urlList: bodyData.urlList,
      executionDoc: bodyData.executionDoc
    }, function (err) {
      if (err) {
        console.error(`NSQwriter Requeue Frontier publish Error: ${err.message}`);
        return reject(err);
      }
      console.info(`Sent to NSQ Requeue Frontier, 150 chars: ${publishedMessageId.substring(0, 150)}`);
      return resolve(publishedMessageId);
    })
  });
}

const startCrawlerSubscriptions = function () {
  let self = this;
  // return crawlerModel.find().then(function (MongoCrawlerDocs) {
  // creating queues and bindings for all of the crawlers in MongoDB  

  // _.each(_.keys(MongoCrawlerDocs), function (key) {

  // for (let i = 1; i <= MongoCrawlerDocs[key].maxParallelRequests; i++) {
  // rabbit.handle({
  //   queue: 'Crawler.' + MongoCrawlerDocs[key].crawlerCustomId,
  //   type: 'crawler.' + MongoCrawlerDocs[key].crawlerCustomId + '.#'
  // },
  NSQreader.on('message',
    function (msg) {
      console.info("Received:", msg.json().url /*, "routingKey:", msg.fields.routingKey*/);
      // // if (job.id % 10 == 0) { // changes Tor IP if it's 10th consecutive job starting
      // //   tr.renewTorSession(function (err, res) {
      // //     if (err) console.error(err);
      // //   });
      // // }

      // const nightmareBrowser = new Nightmare({
      //   executionTimeout: 10, // in ms
      //   webPreferences: {
      //     images: msg.json().executionDoc.loadImages ? true : false
      //   },
      //   // switches: {
      //   //   'proxy-server': 'localhost:8118' // polipo http proxy for Tor
      //   // },
      //   show: true, // true/false - showing a loading browser
      //   ignoreSslErrors: false,
      //   webSecurity: false // disable same origin policy
      // });
      return new Promise((resolve, reject) => {
        CDP.New(function (err, target) {
          if (err) return reject(err);
          console.info('New CDP Target', target);
          resolve(target);
        });
      })
        .then((target) => {
          return CDP({ tab: target })
            .then((client) => {
              // Extract used DevTools domains.
              const { Page, Runtime, Network, Security } = client;

              // extract from page Object and starting values
              const extractedResults = {};
              extractedResults.queuedAt = msg.timestamp;
              extractedResults.crawlMatches = [];
              extractedResults.downloadedBytes = 0;

              const getLoadedPageUrl = () => {
                // Evaluate browser window location URL.
                return new Promise((resolve, reject) => {
                  Runtime.evaluate({ expression: 'window.location.href' }).then((result) => {
                    // console.info('window.location.href', result.result.value);
                    resolve(result.result.value);
                  });
                });
              };
              const getLoadedPageHTML = () => {
                return new Promise((resolve, reject) => {
                  // Evaluate HTML.
                  Runtime.evaluate({ expression: 'document.documentElement.innerHTML' }).then((result) => {
                    console.info('document.documentElement.innerHTML', result.result.value.length);
                    resolve(result.result.value);
                  });
                })
              };
              const getLoadedPageReferrer = () => {
                return new Promise((resolve, reject) => {
                  // Evaluate page referrer.
                  Runtime.evaluate({ expression: 'document.referrer' }).then((result) => {
                    // console.info('document.referrer', result.result.value);
                    resolve(result.result.value);
                  });
                });
              };
              const extractFromPage = Promise.method(() => {
                // Evaluate function chain to extract all of the needed data from page.
                return Promise.all([
                  getLoadedPageUrl(),
                  getLoadedPageHTML(),
                  getLoadedPageReferrer()
                ])
                  // return getLoadedPageUrl()
                  //   .then((loadedUrl) => {
                  //     console.log('loadedUrl', loadedUrl);
                  //     extractedResults.loadedUrl = loadedUrl;
                  //     return getLoadedPageHTML();
                  //   })
                  //   .then((html) => {
                  //     console.log('html.length', html.length);
                  //     extractedResults.html = html;
                  //     extractedResults.htmlLength = html.length;
                  //     return getLoadedPageReferrer();
                  //   })
                  //   .then((referrer) => {
                  //     console.log('referrer', referrer);
                  //     // console.log(extractedResults);
                  //     return extractedResults.referrer = referrer;
                  //   })
                  .then((received) => {
                    // console.log('received', received);
                    extractedResults.loadedUrl = received[0];
                    extractedResults.html = received[1];
                    extractedResults.htmlLength = received[1].length;
                    extractedResults.referrer = received[2];
                    return Promise.resolve(extractedResults);
                  });
              });
              const elementIsOnThePage = (selector) => {
                return new Promise((resolve, reject) => {
                  // Evaluate outerHTML.
                  Runtime.evaluate({ expression: `document.documentElement.querySelector("${selector}")` })
                    .then((result) => {
                      console.info(`document.documentElement.querySelector("${selector}")`, result);
                      if (result && result.result && result.result.value) resolve(true);
                      resolve(false);
                    });
                })
              };
              const endChromeTab = (tabId) => {
                console.info('Chromium Tab is closing!!!');
                return CDP.Close({ id: tabId }, function (err) {
                  if (err) return console.error(`Closing Chrome Tab have failed with ${err.message}`);
                  console.info(`Chrome Tab ${tabId} have been closed.`);
                });
              };

              const ignoreCertificateEvents = () => {
                // ignore all the certificate errors
                return Security.certificateError(({ eventId }) => {
                  return Security.handleCertificateError({
                    eventId,
                    action: 'continue'
                  });
                });
              }
              const allowToContinue = (request) => {
                const { host } = URL.parse(request.url);
                console.log(request.url);
                console.log(host);
                console.log('/' + msg.json().executionDoc.followLinks.crawlerUrlRegex + '/');
                console.log(request.url.match('/' + msg.json().executionDoc.followLinks.crawlerUrlRegex + '/'));
                return new RegExp(msg.json().executionDoc.followLinks.crawlerUrlRegex).test(request.url);
              }
              const requestInterceptedEvents = () => {
                // intercept requests
                return Network.requestIntercepted(({ interceptionId, request }) => {
                  // perform a test against the intercepted request
                  let allowed = allowToContinue(request);
                  console.log(`- ${allowed ? 'ALLOW' : 'BLOCK'} ${request.url}`);
                  return Network.continueInterceptedRequest({
                    interceptionId,
                    errorReason: allowed ? undefined : 'Aborted'
                  });
                });
              }
              const loadingFailedEvents = () => {
                return Network.loadingFailed(params => {
                  console.log('*** loadingFailed: ', params);
                  // console.log('*** loadingFailed: ', params.blockedReason);
                })
              }
              const loadingFinishedEvents = () => {
                return Network.loadingFinished(params => {
                  console.log('<-', params.requestId, params.encodedDataLength);
                })
              }
              const requestWillBeSentEvents = () => {
                return Network.requestWillBeSent((params) => {
                  if (params.request.url === msg.json().url) {
                    // console.log('requestWillBeSent', params);
                    extractedResults.method = params.request.method;
                    extractedResults.loadingStartedAt = params.wallTime * 1000;
                  }
                  console.log(`-> ${params.requestId} ${params.request.url.substring(0, 150)}`);
                });
              }
              const dataReceivedEvents = () => {
                return Network.dataReceived((params) => {
                  // console.log('dataReceived', params);
                  extractedResults.downloadedBytes += params.dataLength;
                });
              }
              const responseReceivedEvents = () => {
                return Network.responseReceived((params) => {
                  if (params.response.url === msg.json().url) {
                    // console.log('responseReceived', params);
                    extractedResults.responseStatus = params.response.status;
                    extractedResults.responseHeaders = params.response.headers;
                    extractedResults.loadingTimeMs = params.response.timing.receiveHeadersEnd;
                  }
                });
              }

              const getLoadedPageElements = (selector, action) => {
                return new Promise((resolve, reject) => {
                  let code = `(function(){var links=[];for(let elm of document.querySelectorAll('${selector}')) {links.push(${action == 'getText' ? 'elm.innerText' : 'elm.href'});}return {'links':links};}())`;
                  Runtime.evaluate({
                    expression: code,
                    returnByValue: true
                  })
                    .then((result) => {
                      resolve(_.chunk(_.uniq(result.result.value.links), 1000));
                    });
                })
              };

              // Enable events on domains we are interested in.
              return Promise.all([
                Network.enable(),
                Page.enable(),
                Security.enable()
              ])
                .then(() => {
                  // Network and Security domain settings
                  return Promise.all([
                    Security.setOverrideCertificateErrors({ override: true }),
                    // Network.setUserAgentOverride({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }),
                    // Network.setBlockedURLs({ urls: msg.json().executionDoc.requestBlockList }),

                  ])
                })
                .then(() => {
                  // Network and Security domain settings
                  return Network.setRequestInterceptionEnabled({ enabled: true });
                })
                .then(() => {
                  // Network and Security domain settings
                  return Network.setCacheDisabled({ cacheDisabled: true });
                })
                .then(() => {
                  // set Network and Security events
                  return Promise.all([
                    ignoreCertificateEvents(),
                    loadingFailedEvents(),
                    loadingFinishedEvents(),
                    requestInterceptedEvents(),
                    requestWillBeSentEvents(),
                    dataReceivedEvents(),
                    responseReceivedEvents()
                  ])
                })
                .then(() => {
                  return Page.navigate({ url: msg.json().url });
                })
                .then(() => {
                  return new Promise((resolve, reject) => {
                    Page.loadEventFired().then(() => {
                      // console.log('Page.loadEventFired');
                      // return extractFromPage()
                      //   .then((result) => resolve)
                      //   .catch((err) => { console.log(err); return endChromeTab(target.id) });
                      return resolve(extractFromPage());
                    });
                  })
                    .then((result) => {
                      return getLoadedPageElements(
                        msg.json().executionDoc.followLinks.elementSelector,
                        msg.json().executionDoc.followLinks.action);
                    })
                    .then(function (allLinkChunks) {
                      // extractedResults.allLinks = _.flatten(allLinksChunks);
                      return Promise.all(allLinkChunks.map((linkChunk) => {
                        return constructUrls(linkChunk, msg.json().url)
                          .then((constructedLinksChunk) => {
                            return Queue.publishMessageRequeue({
                              urlList: constructedLinksChunk,
                              executionDoc: msg.json().executionDoc
                            }, msg.json().uniqueUrl)
                          })
                      }))
                        .catch(function (err) {
                          console.error(new Error(`Queue.publishMessageRequeue failed ${err.message}`));
                          // if requeue of links from the page failed 
                          throw (new Error(`Queue.publishMessageRequeue failed ${err.message}`));
                        });
                    })
                    .then(function () {
                      // TODO: add random delay before finishing the job to emulate human crawling (it will slow down another job request)
                      endChromeTab(target.id);

                      return msg.finish(); // the job have been finished
                    })
                    .catch((err) => {
                      console.error(`ERROR: ${err.message}`);
                      // TODO: consider requeuing the message before cancelling forever
                      if (err)
                        console.error(err); // JSON.stringify(error))); // done(new Error(JSON.stringify(error)));

                      msg.finish(); // finishes the job and saves error
                      endChromeTab(target.id);
                      // // saving failed any failed request to MongoDB
                      // return requestModel.upsertAfterError(
                      //   {
                      //     // Mongoose creating object to DB
                      //     errorInfo: err,

                      //     queuedAt: msg.timestamp,
                      //     uniqueUrl: msg.json().uniqueUrl,
                      //     url: msg.json().url,
                      //     executionId: msg.json().executionDoc._id
                      //   }).finally((upsertResponse) => {
                      //     if (upsertResponse)
                      //       console.error('Crawling failed error saved to Requests Collection', upsertResponse);

                      //     msg.finish(); // finishes the job and saves error
                      //     endChromeTab(target.id);
                      //   });
                    });
                }).catch((err) => {
                  console.error("Chrome err", err);
                  msg.requeue(delay = null, backoff = true); // Chrome Browser failed return message to queue to run again
                });
            }).catch((err) => {
              console.error("CDP err", err);
              msg.requeue(delay = null, backoff = true); // Chrome Browser failed return message to queue to run again
            });
        }).catch((err) => {
          console.error("CDP.new err", err);
          msg.requeue(delay = null, backoff = true); // Chrome Browser failed return message to queue to run again
        });
    })
  // .catch(function (err, msg) {
  //   // do something with the error & message
  //   msg.requeue(delay = null, backoff = true);
  //   if (err) console.error(new Error(err));
  //   // saving failed any failed request to MongoDB
  //   return requestModel.upsertAfterError(
  //     {
  //       // Mongoose creating object to DB
  //       errorInfo: err,
  //       requestedAt: msg.timestamp,
  //       uniqueUrl: msg.json().uniqueUrl,
  //       url: msg.json().url,
  //       executionId: msg.json().executionDoc._id
  //     }).then(function (upsertResponse) {
  //       console.error('Crawling failed error saved to Requests Collection', upsertResponse);
  //     }).catch(function (lastError) {
  //       console.error('lastError', lastError);
  //     });
  // });
}

function constructUrls(urlList, urlString) {
  return new Promise((resolve, reject) => {
    resolve(
      _.map(_.filter(urlList, (url) => { return new URI(url).is("absolute") || _.startsWith('/', url) }),
        (url) => {
          let uri = new URI(url);
          if (uri.is("absolute")) { return url; }
          if (uri.is("relative"))
          { return uri.absoluteTo(urlString).toString(); }
          return '';
        })
    );
  })
}

function filterUrlListByRegex(urlList, crawlerUrlRegex) {

  let pattern = new RegExp(crawlerUrlRegex, 'i'); // url filter locator
  return urlList.filter(function (singleUrl) {
    return pattern.test(singleUrl);
  });
}

exports = module.exports = Queue = {
  startCrawlerSubscriptions: startCrawlerSubscriptions,
  publishMessageRequeue: publishMessageRequeue
};
