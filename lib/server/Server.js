// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var lithium = require('lithium'),
    bison = require('bisonjs'),
    util = require('../shared/util'),
    Action = require('../shared/Action'),
    Room = require('./Room'),
    Player = require('./Player');


// Lockstep Server ------------------------------------------------------------
function Server(config) {

    this._hostname = null;
    this._port = null;
    this._config = util.merge(config || {}, Server.DEFAULTS);

    this._logger = null;

    this._isListening = false;
    this._socket = new lithium.Server(null, bison.encode, bison.decode);
    this._socket.on('connection', this._onConnection.bind(this));

    this._roomMap = {};
    this._roomList = [];

    this._playerMap = {};
    this._playerList = [];
    this._playerNameMap = {};

}

// Statics --------------------------------------------------------------------
Server.PROTOCOL_VERSION = '0.1';
Server.VERSION = '0.01';

Server.DEFAULTS = {
    maxConnectionIdleTime: 1000,
    maxPlayers: 64,
    maxRooms: 32,
    minRoomPlayers: 1,
    maxRoomPlayers: 8,
    minTicksPerSecond: 1,
    maxTicksPerSecond: 30,
    minCountdown: 0,
    maxCountdown: 10,
    maxPlayerEventsPerTick: 8
};

// Methods --------------------------------------------------------------------
Server.prototype = {

    // Public Interface -------------------------------------------------------
    listen: function(port, hostname) {

        if (this._isListening) {
            return false;

        } else {
            this._isListening = true;
            this._port = port;
            this._hostname = hostname || '0.0.0.0';
            this._socket.listen(this._port, this._hostname);
            this.log('Listening');
        }

    },

    addPlayer: function(player) {
        this._playerList.push(player);
        this._playerNameMap['#' + player.getName()] = player;
        this._playerMap[player.getId()] = player;
        this._sendRoomList(player);
    },

    removePlayer: function(player) {

        var name = '#' + player.getName();
        if (this._playerNameMap.hasOwnProperty(name)) {
            this._playerList.splice(this._playerList.indexOf(player), 1);
            delete this._playerMap[player.getId()];
            delete this._playerNameMap[name];
        }

    },

    createRoom: function(gameIdent, gameVersion, data) {

        // Limit the number of rooms that can be open at once
        if (this._roomList.length=== this._config.maxRooms) {
            return null;
        }

        // Generate a room ID, we don't want collisions so we need to try
        // again if we find one. In theory this could loop forever but we assume
        // that in practice this is extremely unlikely
        // (unless Math.random() just keeps returning the same values)
        var id = util.generateRoomId();
        while(this._roomMap.hasOwnProperty(id)) {
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

        this._roomList.push(room);
        this._roomMap[id] = room;
        this.broadcastRoomList();

        return room;

    },

    removeRoom: function(room) {
        delete this._roomMap[room.getId()];
        this._roomList.splice(this._roomList.indexOf(room), 1);
        this.broadcastRoomList();
    },

    broadcastRoomList: function() {

        // Send the list of rooms to all players
        // which are currently not in any room
        for(var i = 0, l = this._playerList.length; i < l; i++) {
            var player = this._playerList[i];
            if (!player.isInRoom()) {
                this._sendRoomList(player);
            }
        }

    },

    setLogger: function(logger) {
        this._logger = logger;
    },

    close: function() {

        if (this._isListening) {

            this.log('Closing...');

            this._isListening = false;
            this._socket.close();

            // Destroy all players, this will also destroy all the rooms
            // once the have no players left
            for(var i = 0, l = this._playerList.length; i < l; i++) {
                this._playerList[i].destroy();
            }

            this.log('Closed');

            return true;

        } else {
            return false;
        }


    },

    // Getters ----------------------------------------------------------------
    getRoomById: function(id) {

        if (this._roomMap.hasOwnProperty(id)) {
            return this._roomMap[id];

        } else {
            return null;
        }

    },

    getConfig: function() {
        return this._config;
    },

    // Events -----------------------------------------------------------------
    _onConnection: function(remote) {

        // Drop remotes if they don't send a login message within the given
        // timeframe
        remote.$idleTimeout = setTimeout(
            remote.reject.bind(remote), this._config.maxConnectionIdleTime
        );

        remote.on('message', this._onRemoteMessage.bind(this, remote));

        remote.send([
            0,
            Action.SERVER_MESSAGE_HELLO,
            [
                Server.PROTOCOL_VERSION,
                Server.VERSION,
                this._config.minRoomPlayers,
                this._config.maxRoomPlayers
            ]
        ]);

    },

    _onRemoteMessage: function(remote, msg) {

        // Ignore invalid messages
        if (!util.isValidMessage(msg)) {
            return;

        } else if (msg[1] === Action.CLIENT_MESSAGE_LOGIN) {

            var rid = msg[0],
                data = msg[2],
                name = data[3];

            // Validate Message
            if (!util.isValidVersion(data[0])) {
                this._sendError(remote, rid, Action.ERROR_INVALID_PARAMETER);

            } else if (data[0] !== Server.PROTOCOL_VERSION) {
                this._sendError(remote, rid, Action.ERROR_PROTOCOL_MISMATCH);

            } else if (!util.isValidGameIdent(data[1])) {
                this._sendError(remote, rid, Action.ERROR_INVALID_PARAMETER);

            } else if (!util.isValidVersion(data[2])) {
                this._sendError(remote, rid, Action.ERROR_INVALID_PARAMETER);

            } else if (!util.isValidPlayerName(name)) {
                this._sendError(remote, rid, Action.ERROR_INVALID_PARAMETER);

            // Check if there's room for another player
            } else if (this._playerList.length === this._config.maxPlayers) {
                this._sendError(remote, rid, Action.ERROR_SERVER_MAX_PLAYERS);

            // Check if the name is available
            } else if (this._playerNameMap.hasOwnProperty('#' + name)) {
                this._sendError(remote, rid, Action.ERROR_SERVER_NAME_IN_USE);

            // Create a new player
            } else {

                // Clean up remote
                clearTimeout(remote.$idleTimeout);
                remote.unbind('message');

                // Accept and create player
                remote.accept();
                remote.player = new Player(this, remote, data[1], data[2], name);
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
    _sendRoomList: function(player) {
        player.send(
            Action.SERVER_MESSAGE_ROOM_LIST, this._roomList.map(function(room) {
                return room.getInfo();
            })
        );
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

