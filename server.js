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

var forks = process.env.NODE_ENV === 'development' ? 1 : 3;

// ----------------------------------------------------------------------------

if( cluster.isMaster ) {
    process.title = 'parent.cssminifier.com';
    for( var i = 0; i < forks; i++ ) {
        console.log('MASTER: Starting child...');
        cluster.fork();
    }

    cluster.on('fork', function(worker) {
        console.log('MASTER: Worker ' + worker.process.pid + ' has been forked');
    });

    cluster.on('online', function(worker) {
        console.log('MASTER: Worker ' + worker.process.pid + ' has responded to say it is online');
    });

    cluster.on('listening', function(worker, address) {
        console.log('MASTER: Worker ' + worker.process.pid + ' is now connected to ' + address.address + ':' + address.port);
    });

    cluster.on('disconnect', function(worker) {
        console.log('MASTER: Worker ' + worker.process.pid + ' is now disconnecting (prior to dieing)');
    });

    cluster.on('exit', function(worker, code, signal) {
        var exitCode = worker.process.exitCode;
        console.log('MASTER: worker ' + worker.process.pid + ' died (' + exitCode + ') due to ' + signal + '.');
        cluster.fork();
    });
}
else {
    // child
    process.title = 'child.cssminifier.com';

    console.log('WORKER: Worker %s started', process.pid);

    var app = require('./lib/app.js');
    var port = process.argv[2] || 3000;

    var server = http.createServer(app);
    server.listen(port, function() {
        console.log('WORKER: Worker %s listening on port %s', process.pid, port);
    });
}

// ----------------------------------------------------------------------------
