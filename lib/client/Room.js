'use strict';

// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var util = require('../shared/util'),
    Emitter = require('../shared/Emitter');


// Local Room Abstraction -----------------------------------------------------
// ----------------------------------------------------------------------------
function Room(client) {

    Emitter.call(this);

    this._client = client;

    this._id = null;
    this._name = null;
    this._gameIdent = null;
    this._gameVersion = null;
    this._playerCount = null;
    this._minPlayers = null;
    this._maxPlayers = null;
    this._tickRate = null;

    this._tickCount = -1;
    this._countdown = -1;
    this._gameParams = {};
    this._owner = null;
    this._isStarted = false;
    this._seed = null;

    this.log('Created');

}

// Methods --------------------------------------------------------------------
util.inherit(Room, Emitter, {

    // Public Interface -------------------------------------------------------
    join: function(password) {
        this.log('Joining...');
        return this._client.__joinRoom(this._id, password);
    },

    start: function(countdown, loadHandler, tickHandler) {
        this.log('Starting...');
        return this._client.__startRoom(countdown, loadHandler, tickHandler);
    },

    cancel: function() {
        this.log('Canceling countdown...');
        return this._client.__cancelRoom();
    },

    leave: function() {
        this.log('Leaving...');
        return this._client.__leaveRoom();
    },

    setOwner: function(player) {
        return this._client.__setRoomOwner(player);
    },

    setPassword: function(password) {
        this.log('Setting password...');
        return this._client.__setRoomPassword(password);
    },

    setParameter: function(key, value) {
        this.log('Setting parameter ', key, '=', value, ' ...');
        return this._client.__setRoomParameter(key, value);
    },

    destroy: function() {

        this.emit('destroy');
        Emitter.prototype.destroy.call(this);

        this._name = null;
        this._gameIdent = null;
        this._gameVersion = null;
        this._playerCount = null;
        this._minPlayers = null;
        this._maxPlayers = null;
        this._gameParams = null;
        this._owner = null;

    },

    // Container Interface ----------------------------------------------------
    update: function(id, name, gameIdent, gameVersion, playerCount, minPlayers, maxPlayers, tickRate) {

        this._id = id;
        this._name = name;
        this._gameIdent = gameIdent;
        this._gameVersion = gameVersion;
        this._playerCount = playerCount;
        this._minPlayers = minPlayers;
        this._maxPlayers = maxPlayers;
        this._tickRate = tickRate;

        this.emit('update');

    },

    // Getter -----------------------------------------------------------------
    getId: function() {
        return this._id;
    },

    getName: function() {
        return this._name;
    },

    getOwner: function() {
        return this._owner;
    },

    getSeed: function() {
        return this._seed;
    },

    getPlayerCount: function() {
        return this._playerCount;
    },

    getMinPlayerCount: function() {
        return this._minPlayers;
    },

    getMaxPlayerCount: function() {
        return this._maxPlayers;
    },

    getTickCount: function() {
        return this._tickCount;
    },

    getTickRate: function() {
        return this._tickRate;
    },

    getParameters: function() {
        return this._gameParams;
    },

    getCountdown: function() {
        return this._countdown;
    },

    isStarted: function() {
        return this._isStarted;
    },

    // Internal ---------------------------------------------------------------
    __setOwner: function(player) {

        // Unset previous owner
        if (this._owner) {
            this._owner.__setOwner(false);
        }

        this._owner = player;
        this._owner.__setOwner(true);

        this.log('Owner set to ', this._owner);
        this.emit('owner', this._owner);

    },

    __setParameter: function(key, value) {
        this._gameParams[key] = value;
        this.log('Set parameter ', key, '=', value);
        this.emit('parameter', key, value);
    },

    __startCountdown: function(seconds) {
        this._countdown = seconds;
        this.emit('countdown.start', seconds);
    },

    __updateCountdown: function(seconds) {
        this._countdown = seconds;
        this.emit('countdown.update', seconds);
    },

    __cancelCountdown: function() {
        this._countdown = -1;
        this.emit('countdown.cancel');
    },

    __endCountdown: function() {
        this._countdown = -1;
        this.emit('countdown.end');
    },

    __setRandomSeed: function(seed) {
        this._seed = seed;
    },

    __setStarted: function() {
        this._isStarted = true;
        this.log('Started');
        this.emit('start');
    },

    __setTickCount: function(count) {
        this._tickCount = count;
    },

    __setPlayerCount: function(count) {
        this._playerCount = count;
    },

    __addPlayer: function(player) {
        this.log('Player joined ', player);
        this.emit('player.join', player);
    },

    __removePlayer: function(player) {
        this.log('Player left ', player);
        this.emit('player.leave', player);
    },

    // Logging ----------------------------------------------------------------
    log: function() {
        this._client.log.apply(
            this._client,
            util.concat(this.toString(), ' >> ', arguments)
        );
    },

    toString: function() {
        return '[ Room #' + this._id + ' | '
                + this._playerCount+ ' player(s) ]';
    }

});

// Exports --------------------------------------------------------------------
module.exports = Room;

