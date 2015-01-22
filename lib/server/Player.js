// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var util = require('../shared/util'),
    Action = require('../shared/Action');


// Server Player --------------------------------------------------------------
function Player(server, remote, gameIdent, gameVersion, name) {

    this._server = server;
    this._remote = remote;
    this._room = null;
    this._responseId = 0;

    this._id = Player.ID++;
    this._gameIdent = gameIdent;
    this._gameVersion = gameVersion;
    this._name = name;

    this._isConnected = true;
    this._isLoaded = false;
    this._tickCount = -1;

    this._remote.on('message', this._onMessage.bind(this));
    this._remote.on('close', this._onClose.bind(this));

    this._server.addPlayer(this);

    this.log('Joined server');

}


// Statics --------------------------------------------------------------------
Player.ID = Math.floor(Math.random() * 65536);//57126


// Methods --------------------------------------------------------------------
Player.prototype = {

    // Public Interface -------------------------------------------------------
    send: function(action, data) {
        this._send([0, action, data === undefined ? null : data]);
    },

    respond: function(action, data) {
        this._send([this._responseId, action, data === undefined ? null : data]);
    },

    joinRoom: function(room) {
        this._room = room;
        this._isLoaded = false;
        this._tickCount = -1;
        this._room.addPlayer(this);
        this.respond(Action.SERVER_RESPOND_ROOM_JOINED);
        this.log('Joined room ', this._room);
    },

    leaveRoom: function() {

        var room = this._room;

        // unset reference before hand so the server sends the new room list
        // before the respond below
        this._room = null;
        room.removePlayer(this);

        this.respond(Action.SERVER_RESPOND_ROOM_LEFT);
        this.log('Left room ', room);

    },

    destroy: function() {

        if (this._room) {
            this._room.removePlayer(this);
        }

        this._remote.close();
        this._isConnected = false;
        this._server.removePlayer(this);
        this._room = null;

        this.log('Destroyed');

        this._server = null;

    },

    // Getters ----------------------------------------------------------------
    getId: function() {
        return this._id;
    },

    getTick: function() {
        return this._tickCount;
    },

    getName: function() {
        return this._name;
    },

    isInRoom: function() {
        return !!this._room;
    },

    isLoaded: function() {
        return this._isLoaded;
    },

    isOwnerOfRoom: function() {
        return this._room && this._room.getOwner() === this;
    },

    // Events -----------------------------------------------------------------
    _onMessage: function(msg) {

        // Ignore any pending messages after disconnect
        if (!this._isConnected) {
            return;

        // Ignore invalid messages
        } else if (!util.isValidMessage(msg)) {
            return;

        } else {

            var action = msg[1],
                data = msg[2];

            // Store response ID of the current message
            this._responseId = msg[0];

            // Most messages require a room
            if (this._room) {

                switch(action) {
                    case Action.CLIENT_MESSAGE_ROOM_LEAVE:
                        this.leaveRoom();
                        break;

                    case Action.CLIENT_MESSAGE_ROOM_SET_OWNER:
                        this._roomSetOwner(data);
                        break;

                    case Action.CLIENT_MESSAGE_ROOM_SET_PARAM:
                        this._roomSetParameter(data);
                        break;

                    case Action.CLIENT_MESSAGE_ROOM_SET_PASSWORD:
                        this._roomSetPassword(data);
                        break;

                    case Action.CLIENT_MESSAGE_ROOM_START:
                        this._roomStart(data);
                        break;

                    case Action.CLIENT_MESSAGE_ROOM_CANCEL_COUNTDOWN:
                        this._roomCancel();
                        break;

                    case Action.CLIENT_RESPOND_ROOM_LOADED:
                        this._isLoaded = true;
                        break;

                    case Action.CLIENT_RESPOND_TICK_CONFIRM:
                        this._roomConfirmTick(data);
                        break;

                    default:
                        this.log('Unknown Message: ', action, data);
                        this._sendError(Action.ERROR_UNKNOWN_ACTION);
                        break;
                }

            } else if (action === Action.CLIENT_MESSAGE_ROOM_CREATE) {
                this._roomCreate(data);

            } else if (action === Action.CLIENT_MESSAGE_ROOM_JOIN) {
                this._roomJoin(data);

            } else {
                this.log('Unknown Message: ', action, data);
                this._sendError(Action.ERROR_UNKNOWN_ACTION);
            }

        }

    },

    _onClose: function() {
        this.log('Left server');
        this.destroy();
    },

    // Internal ---------------------------------------------------------------
    _roomJoin: function(data) {

        // Validate message
        if (!util.isValidRoomId(data[0])) {
            this.log('Invalid room id format');
            this._sendError(Action.ERROR_INVALID_PARAMETER);

        } else if (!util.isValidPassword(data[1])) {
            this.log('Invalid password format');
            this._sendError(Action.ERROR_INVALID_PARAMETER);

        } else {

            // Check if there exists a room for the given ID and join it
            var room = this._server.getRoomById(data[0]);
            if (room) {

                if (room.isStarted()) {
                    this.log('Room already started');
                    this._sendError(Action.ERROR_ROOM_STARTED);

                } else if (room.getGameIdent() !== this._gameIdent) {
                    this.log('Room game ident does not match');
                    this._sendError(Action.ERROR_ROOM_GAME_IDENT);

                } else if (room.getGameVersion() !== this._gameVersion) {
                    this.log('Room game version does not match');
                    this._sendError(Action.ERROR_ROOM_GAME_VERSION);

                } else if (room.isFull()) {
                    this.log('Room is full');
                    this._sendError(Action.ERROR_ROOM_FULL);

                } else if (room.isFull()) {
                    this.log('Room is full');
                    this._sendError(Action.ERROR_ROOM_FULL);

                } else if (!room.isValidPassword(data[1])) {
                    this.log('Password does not match');
                    this._sendError(Action.ERROR_ROOM_INVALID_PASSWORD);

                } else {
                    this.joinRoom(room);
                }

            } else {
                this.log('Room not found');
                this._sendError(Action.ERROR_ROOM_NOT_FOUND);
            }

        }

    },

    _roomCreate: function(data) {

        if (!util.isValidRoomName(data[0])) {
            this._sendError(Action.ERROR_INVALID_PARAMETER);

        } else if (!util.isValidPlayerCount(data[1], this._server.getConfig())) {
            this.log('Invalid min player count for room');
            this._sendError(Action.ERROR_INVALID_PARAMETER);

        } else if (!util.isValidPlayerCount(data[2], this._server.getConfig())) {
            this.log('Invalid max player count for room');
            this._sendError(Action.ERROR_INVALID_PARAMETER);

        } else if (!util.isValidTicksPerSecond(data[3], this._server.getConfig())) {
            this.log('Invalid ticks per second for room');
            this._sendError(Action.ERROR_INVALID_PARAMETER);

        } else if (!util.isValidPassword(data[4])) {
            this.log('Invalid password for room');
            this._sendError(Action.ERROR_INVALID_PASSWORD);

        } else {

            var room = this._server.createRoom(
                this._gameIdent,
                this._gameVersion,
                data
            );

            if (room === null) {
                this.log('Maximum number of rooms reached');
                this._sendError(Action.ERROR_SERVER_MAX_ROOMS);

            } else {
                this.joinRoom(room);
            }

        }

    },

    _roomSetOwner: function(playerId) {

        if (this.isOwnerOfRoom()) {
            this._room.setOwnerById(playerId);
            this.respond(Action.SERVER_RESPOND_ROOM_OWNER_SET);

        } else {
            this._sendError(Action.ERROR_ROOM_NOT_OWNER);
        }

    },

    _roomSetParameter: function(data) {

        if (!util.isValidParameter(data[0], data[1])) {
            this.log('Invalid key/value');
            this._sendError(Action.ERROR_INVALID_PARAMETER);

        } else if (this._room.isStarted()) {
            this.log('Room already started ', this._room);
            this._sendError(Action.ERROR_ROOM_STARTED);

        } else {
            // TODO only allow owner for certain types of parameters?
            this._room.setParameter(data[0], data[1]);
            this.respond(Action.SERVER_RESPOND_ROOM_PARAM_SET);
        }

    },

    _roomSetPassword: function(data) {

        if (!this.isOwnerOfRoom()) {
            this.log('Not room owner', this._room);
            this._sendError(Action.ERROR_ROOM_NOT_OWNER);

        } else if (this._room.isStarted()) {
            this.log('Room already started ', this._room);
            this._sendError(Action.ERROR_ROOM_STARTED);

        } else if (!util.isValidPassword(data)) {
            this.log('Invalid password for room');
            this._sendError(Action.ERROR_ROOM_INVALID_PASSWORD);

        } else {
            this._room.setPassword(data);
            this.respond(Action.SERVER_RESPOND_ROOM_PASSWORD_SET);
        }

    },

    _roomStart: function(data) {

        if (!this.isOwnerOfRoom()) {
            this.log('Not room owner', this._room);
            this._sendError(Action.ERROR_ROOM_NOT_OWNER);

        } else if (this._room.isStarted()) {
            this.log('Room already started ', this._room);
            this._sendError(Action.ERROR_ROOM_STARTED);

        } else if (!this._room.isReady()) {
            this.log('Room not ready ', this._room);
            this._sendError(Action.ERROR_ROOM_NOT_READY);

        } else if (!util.isValidCountdown(data, this._server.getConfig())) {
            this._sendError(Action.ERROR_INVALID_PARAMETER);

        } else {
            this._room.start(data);
            this.respond(Action.SERVER_RESPOND_ROOM_START);
        }

    },

    _roomCancel: function() {

        if (!this.isOwnerOfRoom()) {
            this.log('Not room owner', this._room);
            this._sendError(Action.ERROR_ROOM_NOT_OWNER);

        } else if (!this._room.isCountingDown()) {
            this.log('Room is not counting down', this._room);
            this._sendError(Action.ERROR_ROOM_NOT_COUNTING_DOWN);

        } else {
            this._room.cancel();
            this.respond(Action.SERVER_RESPOND_ROOM_COUNTDOWN_CANCELED);
        }

    },

    _roomConfirmTick: function(data) {

        if (this._room.isStarted() && this._room.isLoaded()) {

            var td = Math.abs(data[0] - this._tickCount);
            if (util.isValidTickCount(data[0]) && (td === 1 || td === 255)) {

                if (util.isValidEventData(data[1], this._server.getConfig())) {
                    this._room.addPlayerEvents(this, data[1]);
                    this._tickCount = data[0];
                }

            } else {
                this._sendError(Action.ERROR_INVALID_PARAMETER);
            }

        }

    },

    _send: function(message) {
        if (this._isConnected) {
            this._remote.send(message);
        }
    },

    _sendError: function(err, description) {
        this.respond(Action.ERROR, err);
    },

    // Logging ----------------------------------------------------------------
    log: function() {
        this._server.log.apply(
            this._server,
            util.concat(this.toString(), ' >> ', arguments)
        );
    },

    toString: function() {
        return '[ Player #' + this._id + ' "' + this._name
                + '" ' + (this.isOwnerOfRoom() ? '(Owner) ' : '')
                + 'with [' + this._gameIdent + ' @ ' + this._gameVersion
                + '] | ' + this._remote.toString() + ' ]';
    }

};


// Exports --------------------------------------------------------------------
module.exports = Player;

