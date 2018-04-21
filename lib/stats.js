// --------------------------------------------------------------------------------------------------------------------
//
// Copyright (c) 2012-2013 AppsAttic Ltd - http://appsattic.com/
// Copyright (c) 2013 Andrew Chilton - http://chilts.org/
//
// --------------------------------------------------------------------------------------------------------------------

// npm
const redis = require('redis')
const rustle = require('rustle')

// --------------------------------------------------------------------------------------------------------------------

// redis
const client = redis.createClient()

const stats = {}

const pages = [ 'home', 'compress', 'minify', 'download', 'raw' ]
pages.forEach(function(name) {
  stats[name] = rustle({
    client       : client,
    domain       : 'cssminifier', // \
    category     : 'hits',        //  >- Keys: "<domain>:<category>:<name>"
    name         : name,          // /
    period       : 24 * 60 * 60,  // one day
    aggregation  : 'sum',
  })
})

stats.pages = pages

// --------------------------------------------------------------------------------------------------------------------

module.exports = stats

// --------------------------------------------------------------------------------------------------------------------
