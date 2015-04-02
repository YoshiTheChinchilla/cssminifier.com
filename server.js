// ----------------------------------------------------------------------------
//
// server.js - the server for cssminifier.com
//
// Copyright 2013 AppsAttic Ltd, http://appsattic.com/
//
// ----------------------------------------------------------------------------

var cluster = require('cluster');
var http = require('http');

"use strict";

// ----------------------------------------------------------------------------

var forks = process.env.NODE_ENV === 'production' ? 3 : 1;
var memUsageEverySecs = process.env.NODE_ENV === 'production' ? 10 * 60 : 10;
var dieInSecs = process.env.NODE_ENV === 'production' ? 3600 + Math.floor(Math.random() * 1800) : 60 + Math.floor(Math.random() * 30);

// ----------------------------------------------------------------------------

function log() {
    var args = Array.prototype.slice.call(arguments);
    args[0] = (new Date()).toISOString() + ' - ' + args[0];
    console.log.apply(console, args);
};

if (cluster.isMaster) {
    process.title = 'parent.cssminifier.com';
    for( var i = 0; i < forks; i++ ) {
        log('MASTER: Starting child...');
        var worker = cluster.fork();
        worker.on('message', receivePing);
    }

    cluster.on('fork', function(worker) {
        log('MASTER: Worker ' + worker.process.pid + ' has been forked');
    });

    cluster.on('online', function(worker) {
        log('MASTER: Worker ' + worker.process.pid + ' has responded to say it is online');
    });

    cluster.on('listening', function(worker, address) {
        log('MASTER: Worker ' + worker.process.pid + ' is now connected to ' + address.address + ':' + address.port);
    });

    cluster.on('disconnect', function(worker) {
        log('MASTER: Worker ' + worker.process.pid + ' is now disconnecting (prior to dieing)');
    });

    cluster.on('exit', function(worker, code, signal) {
        var exitCode = worker.process.exitCode;
        log('MASTER: worker ' + worker.process.pid + ' died (' + exitCode + ') due to ' + signal + '.');
        var worker = cluster.fork();
        worker.on('message', receivePing);
    });

    var msgs = {};
    var pingTimer;
    function receivePing(msg) {
        log('MASTER: got response from ' + msg);
        delete msgs[msg]
        if ( !msgs.length ) {
            return;
        }
        var id = parseInt(msg, 10)
        if ( Object.keys(msgs).length === 0 ) {
          clearTimeout(pingTimer);
          pingTimer = undefined;
        }
    }

    // send a message to the child and wait for a response
    setInterval(function() {
        for (var id in cluster.workers) {
            msgs[id] = 'sent';
            log('MASTER(%s,%s): sending ping to worker', id, cluster.workers[id].process.pid);
            cluster.workers[id].send('Are you there?');
        }

        // see if we get a response within 5s
        pingTimer = setTimeout(function() {
            for(var id in msgs) {
                // kill this child
                log('MASTER(%s,%s): killing worker for not responding to ping', id, cluster.workers[id].process.pid);
                cluster.workers[id].kill();
            }
            clearTimeout(pingTimer);
            pingTimer = undefined;
            msgs = {};
        }, 10 * 1000);

    }, 15 * 1000);
}
else {
    // child
    var worker = cluster.worker;
    process.title = 'child.cssminifier.com';

    log('WORKER(%s,%s): Worker started', worker.id, process.pid);

    var app = require('./lib/app.js');
    var port = 8011;

    var server = http.createServer();
    server.on('request', app);

    server.listen(port, function() {
        log('WORKER(%s,%s): Worker listening on port %s', worker.id, process.pid, port);
    });

    // every hour (+-30mins) or so, disconnect so that the master can spawn a new process
    log('WORKER(%s,%s): Dieing in %s seconds', worker.id, process.pid, dieInSecs);
    setTimeout(function() {
        log('WORKER(%s,%s): Disconnecting myself', worker.id, process.pid);
        worker.disconnect();
        setTimeout(function() {
            log('WORKER(%s,%s): Killing myself', worker.id, process.pid);
            worker.kill();
        }, 2000);
    }, dieInSecs * 1000);

    // every 10 mins, print memory usage
    setInterval(function() {
        var mem       = process.memoryUsage();
        mem.rss       = Math.floor(mem.rss/1024/1024) + 'MB';
        mem.heapTotal = Math.floor(mem.heapTotal/1024/1024) + 'MB';
        mem.heapUsed  = Math.floor(mem.heapUsed/1024/1024) + 'MB';
        log('WORKER(%s,%s): memory - rss=%s, heapUsed=%s, heapTotal=%s', worker.id, process.pid, mem.rss, mem.heapUsed, mem.heapTotal);
    }, memUsageEverySecs * 1000);

    process.on('message', function(msg) {
        log('WORKER(%s,%s): Responding to master ping', worker.id, process.pid);
        process.send(worker.id);
    });
}

// ----------------------------------------------------------------------------
