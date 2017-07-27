const development = {
  NODE_ENV: process.env.NODE_ENV,
  NODE_LOG_LEVEL: process.env.NODE_LOG_LEVEL,
  web: {
    port: process.env.WEB_PORT || 3000
  },
  mongodb: {
    host: "localhost",
    port: 27017,
    db: "trackinops",
    uri: "mongodb://localhost:27017/trackinops",
    // username: "",
    // password: "",
    options: {
      useMongoClient: true,
      // server: { socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000 } },
      // replset: {
      //   ha: true, // Make sure the high availability checks are on,
      //   haInterval: 5000, // Run every 5 seconds
      //   socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000, socketTimeoutMS: 90000 }
      // },
      // config: { autoIndex: false } // calls ensureIndex on every index in a DB, slower restart, more reliable indexes
    }
  },
  rabbit: {
    connection: {
      name: 'trackinopsConnection',
      username: "trackinops",
      password: "trops", //"trackinops",
      server: ["127.0.0.1"], //"93.115.26.183",//"rabbitmq", //["rabbitmq"],,
      port: 5672,
      VHost: "%2ftrackinops",
      timeout: 1000,
      failAfter: 30,
      retryLimit: 400
    },
    prefetchLimit: 4,
    requePrefetchLimit: 2
  },
  levelup: {
    location: './DB/levelDB',
    options: {
      createIfMissing: true,
      errorIfExists: false,
      compression: true,
      cacheSize: 100 * 8 * 1024 * 1024,
      keyEncoding: 'utf8',
      valueEncoding: 'json'
    }
  },
  nsq: {
    server: '127.0.0.1',
    wPort: 32769, // TCP nsqd Write Port, default: 4150
    rPort: 32770, // HTTP nsqlookupd Read Port, default: 4161
    lookupdHTTPAddresses: ['127.0.0.1:32770'] // HTTP default: '127.0.0.1:4161'
  }
};
const production = {
  web: {
    port: process.env.WEB_PORT || 3000
  },
  mongodb: {
    host: "mongod",
    port: 27017,
    db: "trackinops",
    uri: "mongodb://mongod:27017/trackinops",
    options: {
      useMongoClient: true,
      // user: "trackinops", // "trackinopsMongo",
      // pass: "mong0", // "mng0trops",
      // server: {
      //   poolSize: 50,
      //   reconnectTries: 90,
      //   reconnectInterval: 1000, // ms
      //   socketOptions: {
      //     autoReconnect: true,
      //     noDelay: true,
      //     keepAlive: 5 * 60 * 1000,
      //     connectTimeoutMS: 1.5 * 60 * 1000,
      //     socketTimeoutMS: 3 * 60 * 1000
      //   }
      // },
      // replset: {
      //   ha: true, // Make sure the high availability checks are on,
      //   haInterval: 5000, // Run every 5 seconds
      //   socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000, socketTimeoutMS: 90000 }
      // },
      // config: { autoIndex: true } // calls ensureIndex on every index in a DB, slower restart, more reliable indexes
    }
  },
  rabbit: {
    connection: {
      name: 'trackinopsConnection',
      username: "trackinops",
      password: "trops",
      server: "rabbitmq",
      port: 5672,
      VHost: "%2ftrackinops",
      timeout: 1000,
      failAfter: 30,
      retryLimit: 400
    },
    prefetchLimit: 4,
    requePrefetchLimit: 30
  },
  levelup: {
    location: '/usr/src/app/trackinops-crawler/DB/levelDB',
    options: {
      createIfMissing: true,
      errorIfExists: false,
      compression: true,
      cacheSize: 8 * 1024 * 1024 * 1024,
      keyEncoding: 'utf8',
      valueEncoding: 'json'
    }
  },
  nsq: {
    server: 'nsqd-inDocker',
    wPort: 4150, // TCP nsqd Write Port, default: 4150
    rPort: 4161, // HTTP nsqlookupd Read Port, default: 4161
    nsqdTCPAddresses: [`nsqd-inDocker:4150`],
    lookupdHTTPAddresses: ['nsqlookupd:4161'] // HTTP default: '127.0.0.1:4161'
  }

};
module.exports = function (env) {
  if (env === 'production')
    return production;

  if (env === 'test')
    return development;

  if (!env || env === 'dev' || env === 'development')
    return development;
}
