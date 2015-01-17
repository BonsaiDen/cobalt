// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var lithium = require('lithium'),
    //bison = require('bison'),
    util = require('../shared/util'),
    Action = require('../shared/Action'),
    Room = require('./Room'),
    Player = require('./Player');


// Lockstep Server ------------------------------------------------------------
function Server() {

    this._hostname = null;
    this._port = null;

    this._logger = null;

    this._socket = new lithium.Server(null, JSON.stringify, JSON.parse);
    this._socket.on('connection', this._onConnection.bind(this));

    this._rooms = {};
    this._players = [];

}


// Statics --------------------------------------------------------------------
Server.PROTOCOL_VERSION = '0.1';
Server.VERSION = '0.01';
Server.MIN_PLAYERS_PER_ROOM = 1; // TODO move into server config
Server.MAX_PLAYERS_PER_ROOM = 8; // TODO move into server config


// Methods --------------------------------------------------------------------
Server.prototype = {

    // Public Interface -------------------------------------------------------
    listen: function(port, hostname) {

        this._port = port;
        this._hostname = hostname || '0.0.0.0';
        this._socket.listen(this._port, this._hostname);

        this.log('Listening');

    },

    addPlayer: function(player) {
        this._players.push(player);
        this._sendRoomList(player);
    },

    removePlayer: function(player) {

        var index = this._players.indexOf(player);
        if (index !== -1) {
            this._players.splice(index, 1);
            return true;

        } else {
            return false;
        }

    },

    createRoom: function(gameIdent, gameVersion, data) {

        // Generate a room ID, we don't want collisions so we need to try
        // again if we find one. In theory this could loop forever but we assume
        // that in practice this is extremely unlikely
        // (unless Math.random() just keeps returning the same values)
        var id = util.generateRoomId();
        while(this._rooms.hasOwnProperty(id)) {
            id = util.generateRoomId();
        }

        var room = new Room(
            this,
            id,
            gameIdent,
            gameVersion,
            data[0],
            data[1],
            data[2],
            data[3],
            data[4]
        );

        this._rooms[id] = room;
        this.broadcastRoomList();

        return room;

    },

    removeRoom: function(room) {
        delete this._rooms[room.getId()];
        this.broadcastRoomList();
    },

    broadcastRoomList: function() {

        // Send the list of rooms to all players
        // which are currently not in any room
        for(var i = 0, l = this._players.length; i < l; i++) {
            var player = this._players[i];
            if (!player.isInRoom()) {
                this._sendRoomList(player);
            }
        }

    },

    setLogger: function(logger) {
        this._logger = logger;
    },

    close: function() {

        this.log('Closing...');

        this._socket.close();

        // Destroy all players, this will also destroy all the rooms
        // once the have no players left
        for(var i = 0, l = this._players.length; i < l; i++) {
            this._players[i].destroy();
        }

        this.log('Closed');

    },

    // Getters ----------------------------------------------------------------
    getRoomById: function(id) {

        if (this._rooms.hasOwnProperty(id)) {
            return this._rooms[id];

        } else {
            return null;
        }

    },

    getMinPlayerCount: function() {
        return Server.MIN_PLAYERS_PER_ROOM;
    },

    getMaxPlayerCount: function() {
        return Server.MAX_PLAYERS_PER_ROOM;
    },

    // Events -----------------------------------------------------------------
    _onConnection: function(remote) {
        remote.on('message', this._onRemoteMessage.bind(this, remote));
        remote.send([
            0,
            Action.SERVER_MESSAGE_HELLO,
            [
                Server.PROTOCOL_VERSION,
                Server.VERSION,
                Server.MIN_PLAYERS_PER_ROOM,
                Server.MAX_PLAYERS_PER_ROOM
            ]
        ]);
    },

    _onRemoteMessage: function(remote, msg) {

        // Ignore invalid messages
        if (!util.isValidMessage(msg)) {
            return;

        } else if (msg[1] === Action.CLIENT_MESSAGE_LOGIN) {

            var rid = msg[0],
                data = msg[2];

            // Validate Message
            if (!util.isValidVersion(data[0])) {
                this._sendError(remote, rid, Action.ERROR_INVALID_PARAMETER);

            } else if (data[0] !== Server.PROTOCOL_VERSION) {
                this._sendError(remote, rid, Action.ERROR_PROTOCOL_MISMATCH);

            } else if (!util.isValidGameIdent(data[1])) {
                this._sendError(remote, rid, Action.ERROR_INVALID_PARAMETER);

            } else if (!util.isValidVersion(data[2])) {
                this._sendError(remote, rid, Action.ERROR_INVALID_PARAMETER);

            } else if (!util.isValidPlayerName(data[3])) {
                this._sendError(remote, rid, Action.ERROR_INVALID_PARAMETER);

            } else {
                remote.unbind('message');
                remote.accept();
                remote.player = new Player(this, remote, data[1], data[2], data[3]);
                remote.send([
                    msg[0],
                    Action.SERVER_RESPOND_LOGIN,
                    [remote.player.getId(), remote.player.getName()]
                ]);
            }

        } else {
            this._sendError(remote, msg[0], Action.ERROR_INVALID_PARAMETER);
        }

    },

    // Internal ---------------------------------------------------------------
    _getRoomList: function() {

        var list = [];

        for(var i in this._rooms) {
            if (this._rooms.hasOwnProperty(i)) {
                list.push(this._rooms[i].getInfo());
            }
        }

        return list;

    },

    _sendRoomList: function(player) {
        player.send(Action.SERVER_MESSAGE_ROOM_LIST, this._getRoomList());
    },

    _sendError: function(remote, rid, err) {
        remote.send([rid, Action.ERROR, err]);
    },

    // Logging ----------------------------------------------------------------
    log: function() {
        util.log(this._logger, this.toString(), arguments);
    },

    toString: function() {
        return '[ Server ' + this._hostname + ':' + this._port + ' ]';
    }

};


// Exports --------------------------------------------------------------------
module.exports = Server;

