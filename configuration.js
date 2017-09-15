const development = {
  NODE_ENV: process.env.NODE_ENV,
  NODE_LOG_LEVEL: process.env.NODE_LOG_LEVEL,
  nsq: {
    server: '127.0.0.1',
    wPort: 32769, // TCP nsqd Write Port, default: 4150
    rPort: 32770, // HTTP nsqlookupd Read Port, default: 4161
    lookupdHTTPAddresses: ['127.0.0.1:32770'] // HTTP default: '127.0.0.1:4161'
  }
};
const production = {
  nsq: {
    server: 'nsqd',
    wPort: 4150, // TCP nsqd Write Port, default: 4150
    rPort: 4161, // HTTP nsqlookupd Read Port, default: 4161
    nsqdTCPAddresses: [`nsqd:4150`],
    lookupdHTTPAddresses: ['nsqlookupd:4161'],
    readerOptions: {
      clientId: process.env.nsqClientId || '',
      maxInFlight: 5,
      maxBackoffDuration: 128,
      maxAttempts: 3,
      requeueDelay: 90,
      nsqdTCPAddresses: [`nsqd:4150`],
      lookupdHTTPAddresses: ['nsqlookupd:4161'], // HTTP default: '127.0.0.1:4161'
      messageTimeout: 3 * 60 * 1000 // 3 min
    }
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
