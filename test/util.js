// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var net = require('net'),
    Cobalt = require('../lib'),
    WebSocket = require('websocket').w3cwebsocket,
    server = null,
    clients = [],
    port = 0;

// Setup ----------------------------------------------------------------------
global.WebSocket = WebSocket;

beforeEach(function() {

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
    });
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

module.exports = {

    getClient: function(gameIdent, gameVersion, loadHandler, tickHandler) {

        var client = new Cobalt.Client(
            gameIdent, gameVersion, null, null, loadHandler, tickHandler
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

