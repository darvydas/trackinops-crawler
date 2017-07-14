const mongoose = require('mongoose');
const Schema = mongoose.Schema;
// const ObjectId = Schema.ObjectId;
const Promise = require('bluebird');
const _ = require('lodash');

const subSchemaParser = new Schema(
  {
    path: String,
    name: String,
    sku: String,
    productId: String,
    categoryId: String,
    priceCurrent: String,
    currency: String,
    image: String,
    description: String
  }, { _id: false });

const subSchemaCrawlMatches = new Schema({
  pageType: String,
  urlRegEx: String,  // required
  waitForSelector: String,
  parser: subSchemaParser
}, { _id: false });

const subSchemaParserResult = new Schema({
  pageType: String,
  data: subSchemaParser
}, { _id: false });

const subSchemaStage = new Schema({
  stage: {
    type: String,
    enum: ['NEW', 'PARSED', 'ERROR']
  },
  timestamp: { type: Date, default: Date.now() }
}, { _id: false })

const requestSchema = new Schema({
  executionId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  stages: [subSchemaStage],
  url: String,
  loadedUrl: String,
  queuedAt: Date,
  loadingStartedAt: Date,
  loadingTimeMs: Number,

  pageMatched: [subSchemaCrawlMatches],
  responseStatus: Number,
  responseHeaders: Object, // TODO: for safety reasons - can't be Object

  parserStartedAt: Date,
  parserFinishedAt: Date,
  parserResult: [subSchemaParserResult],

  // String that uniquely identifies the web page in the crawling queue.
  // uniqueUrl should be generated from the 'url' property as follows:
  //  1 hostname and protocol is converted to lower-case
  //  2 trailing slash is removed
  //  3 common tracking parameters starting with 'utm_' are removed
  //  4 query parameters are sorted alphabetically
  //  5 whitespaces around all components of the URL are trimmed
  //  6 if the 'urlIncludeFragment' setting is disabled, the URL fragment (#) is removed completely
  uniqueUrl: {
    type: String
  },

  method: String,
  referrer: String,
  downloadedBytes: Number,
  html: {
    toLength: Number,
    toString: String,
    allLinks: [String],
    followingLinks: [String]
  },

  depth: Number,

  errorInfo: String
});

requestSchema.index({ executionId: 1, uniqueUrl: 1 }, { unique: true });

requestSchema.statics = {

  saveNew: Promise.method(function (data) {
    const reqSave = new Requests({
      executionId: data.executionId,
      url: data.url,
      uniqueUrl: data.uniqueUrl
    });
    reqSave.stages.push({ stage: 'NEW' });
    const err = reqSave.validateSync();
    if (err && err.toString()) throw new Error(err.toString());
    return /*this.exec();*/  reqSave.save();
  }),

  upsertAfterParser: Promise.method(function (update, options) {
    options = options || { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true };
    const conditions = {
      executionId: mongoose.Types.ObjectId(update.executionId),
      uniqueUrl: update.uniqueUrl
    };
    return this
      .findOneAndUpdate(conditions, {
        $set: {
          html: {
            toLength: update.html.toLength,
            toString: update.html.toString,
            allLinks: update.html.allLinks,
            followingLinks: update.html.followingLinks
          },

          parserStartedAt: update.parserStartedAt,
          parserFinishedAt: update.parserFinishedAt,
          parserResult: update.parserResult,
          pageMatched: update.pageMatched,

          referrer: update.referrer,

          // data only awailable on network requests, TODO: extract network request dat
          method: update.method,
          downloadedBytes: update.downloadedBytes || 0,
          responseHeaders: update.responseHeaders,
          responseStatus: update.responseStatus || 0,

          queuedAt: update.queuedAt,
          loadingStartedAt: update.loadingStartedAt,
          loadingTimeMs: update.loadingTimeMs || 0,

          executionId: update.executionId,
          url: update.url,
          uniqueUrl: update.uniqueUrl,

          loadedUrl: update.loadedUrl
        },
        $push: { stages: { stage: 'PARSED', timestamp: Date.now() } }
      }, options)
      .exec(function (err, rez) {
        if (err) throw err;
        return rez;
      });
  }),

  upsertAfterError: Promise.method(function (upsert) {
    options = { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true };
    const conditions = {
      executionId: mongoose.Types.ObjectId(upsert.executionId),
      uniqueUrl: upsert.uniqueUrl
    };
    return this
      .findOneAndUpdate(conditions, {
        $set: {
          errorInfo: upsert.errorInfo,
          uniqueUrl: upsert.uniqueUrl,
          url: upsert.url,
          executionId: upsert.executionId
        },
        $push: { stages: { stage: 'ERROR', timestamp: Date.now() } }
      }, options).exec(function (err, rez) {
        if (err) throw err;
        return rez;
      });
  }),
  // unique statics mongo shell test query
  //     db.getCollection('requests').aggregate([
  //   { $match: { executionId: ObjectId("592a6edc16331d3c7a38344f") } },
  //   {
  //     $group: {
  //       _id: '$executionId',
  //       queuedURLs: { $push: "$uniqueUrl" },
  //       queuedTotal: { $sum: 1 }
  //     }
  //   },
  //   {
  //     $project: {
  //       _id: 1,
  //       urlFounded: { $size: { $filter: { input: "$queuedURLs", as: "queuedUrl", cond: { $eq: ["$$queuedUrl", 'http://www.conrad.com/ce/en'] } } } },
  //       queuedTotal: 1
  //     }
  //   }
  // ])
  isNew: function (executionId, uniqueUrl) {
    return this.model('requests')
      .aggregate()
      .match({ 'executionId': mongoose.Types.ObjectId(executionId) })
      .group({
        _id: '$executionId',
        queuedURLs: { $push: "$uniqueUrl" },
        queuedTotal: { $sum: 1 }
      })
      .project({
        _id: 1,
        urlFounded: { $size: { $filter: { input: "$queuedURLs", as: "queuedUrl", cond: { $eq: ["$$queuedUrl", uniqueUrl] } } } },
        queuedTotal: 1
      })
      .exec(function (err, rez) {
        if (err) throw err;
        return {
          urlFounded: rez.urlFounded || 0,
          queuedTotal: rez.queuedTotal || 0
        };
      });
  },

  reachedMaxCrawledPagesLimit: Promise.method(function (executionId, queueLimit) {
    return this.model('requests')
      .count({ executionId: executionId })
      .then(function (alreadyQueued) {
        if (queueLimit && queueLimit > 0 && alreadyQueued > queueLimit) {
          throw new Error(executionId + ' have reached maxCrawledPages limit: '
            + alreadyQueued + ' / ' + queueLimit);
        }
        return Promise.resolve(alreadyQueued);
      })
  }),

};



module.exports = Requests = mongoose.model('requests', requestSchema);
