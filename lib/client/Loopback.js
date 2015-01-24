'use strict';

// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var util = require('../shared/util'),
    bison = require('bisonjs'),
    Emitter = require('../shared/Emitter');

// Loopback Interface for Server Emulation in Single Player -------------------
// ----------------------------------------------------------------------------
function Loopback(delay) {

    this._delay = delay || 0;
    this._server = null;
    this._clients = [];

    var that = this;

    // These get invoked with new by the caller so we need to preserver the
    // correct this context
    this.Client = function() {
        var client = new Client(that);
        that._clients.push(client);
        return client;
    };

    this.Server = function() {
        that._server = new Server(that);
        return that._server;
    };

}

// Methods --------------------------------------------------------------------
Loopback.prototype = {

    connectClient: function(client) {

        if (this._server) {
            this._server.emit('connection', new Remote(this, client));
            client.emit('connection');

        } else {
            client.emit('close', true);
        }

    },

    sendFromClient: function(remote, msg) {
        if (remote && remote.client) {
            remote.emit('message', msg);
        }
    },

    closeClient: function(client) {

        if (client.remote) {
            client.remote.emit('close', true);
            client.emit('close', false);
            client.remote.client = null;
            client.remote = null;
        }

    },

    sendFromRemote: function(client, msg) {
        if (client && client.remote) {
            client.emit('message', msg);
        }
    },

    closeRemote: function(remote) {

        if (remote && remote.client) {
            remote.client.emit('close', true);
            remote.emit('close', false);
            remote.client.remote = null;
            remote.client = null;
        }

    },

    closeServer: function() {

        if (this._server) {

            for(var i = 0, l = this._clients.length; i < l; i++) {
                this.closeRemote(this._clients[i].remote);
            }

            this._server = null;

        }

    },

    async: function(method, target, msg) {

        if (this._delay === 0 && typeof setImmediate === 'function') {
            setImmediate(method.bind(this, target, msg));

        } else {
            setTimeout(method.bind(this, target, msg), this._delay);
        }

    }

};

// Client Mock ----------------------------------------------------------------
// ----------------------------------------------------------------------------
function Client(loopback) {
    Emitter.call(this);
    this.remote = null;
    this._loopback = loopback;
}

util.inherit(Client, Emitter, {

    connect: function() {
        this._loopback.async(this._loopback.connectClient, this);
    },

    send: function(msg) {

        var data = bison.decode(bison.encode(msg));
        if (data === undefined) {
            console.error(msg);
            throw new Error('Failed to encode/decode message to Server!');
        }

        this._loopback.async(
            this._loopback.sendFromClient,
            this.remote,
            data
        );

    },

    close: function() {
        this._loopback.async(this._loopback.closeClient, this);
    }

});

// Remote Mock ----------------------------------------------------------------
// ----------------------------------------------------------------------------
function Remote(loopback, client) {

    Emitter.call(this);

    this.client = client;
    client.remote = this;

    this._loopback = loopback;

}

util.inherit(Remote, Emitter, {

    send: function(msg) {

        var data = bison.decode(bison.encode(msg));
        if (data === undefined) {
            console.error(msg);
            throw new Error('Failed to encode/decode message to Client!');
        }

        this._loopback.async(
            this._loopback.sendFromRemote,
            this.client,
            data
        );

    },

    accept: function() {
    },

    reject: function() {
        this.close();
    },

    close: function() {
        this._loopback.async(this._loopback.closeRemote, this);
    }

});

// Server Mock ----------------------------------------------------------------
// ----------------------------------------------------------------------------
function Server(loopback) {
    Emitter.call(this);
    this._loopback = loopback;
}

util.inherit(Server, Emitter, {

    listen: function() {

    },

    close: function() {
        this._loopback.closeServer();
    }

});

// Exports --------------------------------------------------------------------
module.exports = Loopback;

