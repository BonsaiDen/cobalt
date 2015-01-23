// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var net = require('net'),
    Cobalt = require('../lib'),
    WebSocket = require('websocket').w3cwebsocket,
    networkInterface = null,
    server = null,
    clients = [],
    port = 0;

// Select Network Interface ---------------------------------------------------


// Setup ----------------------------------------------------------------------
global.WebSocket = WebSocket;

beforeEach(function() {

    // Setup Network Interface
    if (process.env.NETWORK_INTERFACE === 'loopback') {
        var Loopback = require('../lib/client/Loopback');
        networkInterface = new Loopback();

    } else {
        networkInterface = null;
    }


    // Get an unused port by binding to 0 which makes the kernel select a
    // free port
    // This will not re-use previously ports acquired via this method unless it
    // absolutely has to (i.e. there is no other open port left)
    var s = new net.Server();
    s.listen(0);

    // Then unbind from the port, this will cause it to stay open until
    // someone else binds to it explictly.
    port = s.address().port;
    s.close();

    server = new Cobalt.Server({
        maxConnectionIdleTime: 150,
        maxTicksPerSecond: 512,
        maxPlayerEventsPerTick: 8,
        maxPlayers: 2,
        maxRooms: 1

    }, networkInterface);

    server.setLogger(function() {});
    server.listen(port);

});

afterEach(function(done) {

    server.close();
    server = null;

    clients.forEach(function(client) {
        client.close().then(function() {
        }, function() {
        });
    });

    clients.length = 0;

    setTimeout(done);

});

// Test Interface -------------------------------------------------------------
module.exports = {

    getInterfaceName: function() {
        return '(' + (process.env.NETWORK_INTERFACE || 'WebSocket') + ')';
    },

    getClient: function(gameIdent, gameVersion, loadHandler, tickHandler) {

        var client = new Cobalt.Client(
            gameIdent, gameVersion, null, null, loadHandler, tickHandler,
            networkInterface
        );

        client.setLogger(function() {});
        clients.push(client);

        return client;

    },

    getServer: function() {
        return server;
    },

    getPort: function() {
        return port;
    }

};

