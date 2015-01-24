// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var util = require('../shared/util'),
    Action = require('../shared/Action');


// Lockstepped Server Room ----------------------------------------------------
function Room(
    server, id, gameIdent, gameVersion,
    name, minPlayers, maxPlayers, tickRate, password
) {

    this._server = server;

    this._id = id;
    this._gameIdent = gameIdent;
    this._gameVersion = gameVersion;
    this._gameParams = {};
    this._owner = null;
    this._events = [];

    this._name = name;
    this._minPlayers = minPlayers;
    this._maxPlayers = maxPlayers;
    this._players = [];
    this._password = password;

    this._isStarted = false;
    this._isLoaded = false;

    this._tickCount = -1;
    this._nextTickTime = 0;
    this._tickRate = tickRate;
    this._secondsLeft = 0;
    this._countdownTimeout = null;
    this._loopTimeout = null;
    this._fastLoopTimeout = null;

    this.log('Created');

}

// Statics --------------------------------------------------------------------
Room.useImmediate = typeof setImmediate === 'function';


// Methods --------------------------------------------------------------------
Room.prototype = {

    // Public Interface -------------------------------------------------------
    start: function(secondsLeft) {

        this.log('Starting Game');

        this._isStarted = true;
        this._tickCount = -1;

        // Check if we need to run a countdown before the starting the room
        if (secondsLeft > 0) {
            this.log('Countdown started');
            this._secondsLeft = secondsLeft;
            this._countdownTimeout = setTimeout(this._countdown.bind(this));
            this._send(
                Action.SERVER_MESSAGE_ROOM_COUNTDOWN_STARTED,
                this._secondsLeft
            );

        } else {
            this._load();
        }

    },

    cancel: function() {

        if (this._secondsLeft > 0) {

            clearTimeout(this._countdownTimeout);

            this._isStarted = false;
            this._secondsLeft = 0;
            this._send(Action.SERVER_MESSAGE_ROOM_COUNTDOWN_CANCELED);

        }

    },

    setParameter: function(key, value) {
        this._gameParams[key] = value;
        this._send(Action.SERVER_MESSAGE_ROOM_PARAM_SET, [key, value]);
        this.log('Parameter set: ', key, '=', value);
    },

    setPassword: function(password) {
        this._password = password;
        this.log('Password set by owner');
    },

    setOwner: function(player) {
        if (player && player !== this._owner) {
            this._owner = player;
            this._send(Action.SERVER_MESSAGE_ROOM_SET_OWNER, this._owner.getId());
            this.log('Is now owned by ', this._owner);
        }
    },

    setOwnerById: function(playerId) {
        return this.setOwner(this._getPlayerById(playerId));
    },

    addPlayerEvents: function(player, events) {

        var maxEvents = this._server.getConfig().maxPlayerEventsPerTick;
        for(var i = 0, l = Math.min(events.length, maxEvents); i < l; i++) {
            this._events.push([player.getId(), events[i]]);
        }

    },

    addPlayer: function(player) {

        // Add player to room
        this._players.push(player);

        // Send room info to player
        player.send(
            Action.SERVER_MESSAGE_ROOM_JOINED,
            this.getInfo()
        );

        // Send the list of players to all players in the room
        this._send(
            Action.SERVER_MESSAGE_ROOM_PLAYER_LIST,
            this._getPlayerList()
        );

        // Notify the room that the player has joined
        this._send(
            Action.SERVER_MESSAGE_ROOM_PLAYER_JOINED,
            player.getId()
        );

        this.log('Added player ', player);

        // First player becomes the room owner (this is send to the room)
        if (this._players.length === 1) {
            this.setOwner(player);

        // Otherwise notify the player of the current room owner
        // and send the parameter list
        } else {

            player.send(
                Action.SERVER_MESSAGE_ROOM_SET_OWNER,
                this._owner.getId()
            );

            for(var i in this._gameParams) {
                if (this._gameParams.hasOwnProperty(i)) {
                    player.send(
                        Action.SERVER_MESSAGE_ROOM_PARAM_SET,
                        [i, this._gameParams[i]]
                    );
                }
            }

        }

    },

    removePlayer: function(player) {

        var index = this._players.indexOf(player);
        if (index === -1) {
            return false;
        }

        // Notify the room that the player has left
        this._send(Action.SERVER_MESSAGE_ROOM_PLAYER_LEFT, player.getId());

        // Remove the player from the room
        this._players.splice(index, 1);

        // Remove outstanding events for the player
        this._events = this._events.filter(function(event) {
            return event[0] !== player.getId();
        });

        this.log('Removed player ', player);

        // If we remove the last player, destroy the room
        if (this._players.length === 0) {
            this.log('Now empty, destroying');
            this.destroy();
            return;

        // If we remove the owner, make the first player in the list the new one
        } else if (player === this._owner) {
            this.log('Owner left');
            this.setOwner(this._players[0]);
        }

        // Update the room's player list for the remaining players
        this._send(Action.SERVER_MESSAGE_ROOM_PLAYER_LIST, this._getPlayerList());

        // Send out the updated room list to all players on the server
        this._server.broadcastRoomList();

        return true;

    },

    destroy: function() {

        if (Room.useImmediate) {
            clearImmediate(this._fastLoopTimeout);
        }

        clearTimeout(this._countdownTimeout);
        clearTimeout(this._loopTimeout);

        this._players.forEach(function(player) {
            player.leaveRoom();
        });

        this._owner = null;
        this._server.removeRoom(this);
        this._players.length = 0;

        this.log('Destroyed');

        this._server = null;

    },

    // Getters ----------------------------------------------------------------
    getId: function() {
        return this._id;
    },

    getName: function() {
        return this._name;
    },

    getGameIdent: function() {
        return this._gameIdent;
    },

    getGameVersion: function() {
        return this._gameVersion;
    },

    getInfo: function() {
        return [
            this._id,
            this._name,
            this.getGameIdent(),
            this.getGameVersion(),
            this._players.length,
            this._minPlayers,
            this._maxPlayers,
            this._tickRate
        ];
    },

    getOwner: function() {
        return this._owner;
    },

    isStarted: function() {
        return this._isStarted;
    },

    isCountingDown: function() {
        return this._isStarted && this._secondsLeft > 0;
    },

    isLoaded: function() {
        return this._isLoaded;
    },

    isReady: function() {
        return this._players.length >= this._minPlayers;
    },

    isFull: function() {
        return this._players.length === this._maxPlayers;
    },

    isValidPassword: function(password) {
        return password === this._password;
    },

    // Internal ---------------------------------------------------------------
    _countdown: function() {

        this.log('Countdown ', this._secondsLeft.toString(), ' second(s)...');

        this._send(
            Action.SERVER_MESSAGE_ROOM_COUNTDOWN_UPDATED,
            this._secondsLeft
        );

        if (this._secondsLeft === 0) {
            this._load();

        } else {
            this._secondsLeft--;
            this._countdownTimeout = setTimeout(
                this._countdown.bind(this), 1000
            );
        }

    },

    _load: function() {
        this._send(Action.SERVER_MESSAGE_ROOM_LOAD);
        this._loopTimeout = setTimeout(this._loop.bind(this));
        this.log('Now loading...');
    },

    _loop: function() {

        var perTick = (1000 / this._tickRate);

        // Initial setup
        if (this._nextTickTime === 0) {
            this._nextTickTime = Date.now() + perTick;
            this._boundLoop = this._loop.bind(this);
        }

        // Check how much difference there is left
        var diff = Math.max(this._nextTickTime - Date.now(), 0);

        // If there's more than 3ms left we use the default setTimeout
        if (diff > 3 || diff === 0 || !Room.useImmediate) {

            this._loopTimeout = setTimeout(this._boundLoop);

            // If we hit the target time, we run the update loop
            if (diff === 0){
                this._nextTickTime = Date.now() + perTick;
                this._lastTickTime = Date.now();
                this._update();
            }

        // Otherwise we do high precision timing via setImmediate
        } else {
            this._fastLoopTimeout = setImmediate(this._boundLoop);
        }

    },

    _update: function() {

        var latest = 1024,
            loaded = true,
            i = 0,
            l = this._players.length;

        // Check active players for their tick and loading status
        for(i = 0; i < l; i++) {
            var player = this._players[i];
            latest = Math.min(player.getTick(), latest);
            loaded &= player.isLoaded();
        }

        // Check if the room is loaded and a the latest tick was distributed
        if (loaded && this._isLoaded && latest === this._tickCount) {

            this._tickCount = (this._tickCount + 1) % 256;

            for(i = 0; i < l; i++) {
                this._players[i].send(
                    Action.SERVER_MESSAGE_TICK_UPDATE,
                    [this._tickCount, this._events]
                );
            }

            this._events.length = 0;

        // Check if we just loaded the room and tell clients
        } else if (loaded && !this._isLoaded) {

            var seed = Math.round(Math.random() * 65536);

            for(i = 0; i < l; i++) {
                this._players[i].send(Action.SERVER_MESSAGE_ROOM_COUNTDOWN_ENDED);
                this._players[i].send(Action.SERVER_MESSAGE_ROOM_STARTED, seed);
            }

            this._isLoaded = true;
            this.log('Game started');

        }

    },

    _getPlayerList: function() {
        return this._players.map(function(player) {
            return [player.getId(), player.getName()];
        });
    },

    _getPlayerById: function(id) {

        for(var i = 0, l = this._players.length; i < l; i++) {
            if (this._players[i].getId() === id) {
                return this._players[i];
            }
        }

        return null;

    },

    _send: function(action, data) {
        this._players.forEach(function(player) {
            player.send(action, data);
        });
    },

    // Logging ----------------------------------------------------------------
    log: function() {
        this._server.log.apply(
            this._server,
            util.concat(this.toString(), ' >> ', arguments)
        );
    },

    toString: function() {
        return '[ Room #' + this._id + ' | '
                + this._players.length + ' player(s) for [' + this._gameIdent
                + ' @ '  + this._gameVersion + '] ]';
    }

};


// Exports --------------------------------------------------------------------
module.exports = Room;

