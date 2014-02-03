// --------------------------------------------------------------------------------------------------------------------
//
// stats.js - the stats for cssminifier.com
//
// Copyright (c) 2012-2013 AppsAttic Ltd - http://appsattic.com/
// Copyright (c) 2013 Andrew Chilton - http://chilts.org/
//
// --------------------------------------------------------------------------------------------------------------------

// npm
var redis = require('redis');
var rustle = require('rustle');

// --------------------------------------------------------------------------------------------------------------------

var log2 = require('log2');
var logStream = process.env.NODE_ENV === 'production'
    ? fs.createWriteStream('/var/log/cssminifier-com/app.log', { flags : 'a' })
    : process.stdout;
var log = log2({ stream : logStream })

// redis
var client = redis.createClient();
client.select(1, function() {
    log('Redis Database selected');
});
client.on('ready', function() {
    log('Redis Ready');
});
client.on('connect', function() {
    log('Redis Connect');
});
client.on('drain', function() {
    log('Redis Drain');
});
client.on('idle', function() {
    log('Redis Idle');
});
client.on('error', function(err) {
    log('Redis Error : ' + err);
});
client.on('end', function() {
    log('Redis End');
});

var stats = {};

var pages = [ 'home', 'minify', 'download', 'raw' ];
pages.forEach(function(name) {
    stats[name] = rustle({
        client       : client,
        domain       : 'cssminifier', // \
        category     : 'hits',        //  >- Keys: "<domain>:<category>:<name>"
        name         : name,          // /
        period       : 24 * 60 * 60,       // one day
        aggregation  : 'sum',
    });
});

stats.pages = pages;

// --------------------------------------------------------------------------------------------------------------------

module.exports = stats;

// --------------------------------------------------------------------------------------------------------------------
