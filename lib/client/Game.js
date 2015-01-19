/*global window */
'use strict';

// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var Promise = require('bluebird'),
    util = require('../shared/util'),
    Client = require('./Client'),
    Emitter = require('./Emitter');

// Lockstep Game Abstraction --------------------------------------------------
// ----------------------------------------------------------------------------
function Game(gameIdent, gameVersion, playerClass, roomClass) {

    Emitter.call(this);

    this._logger = null;
    this._client = new Client(
        gameIdent, gameVersion,
        playerClass, roomClass,
        this._loadWrapper.bind(this),
        this._tickWrapper.bind(this)
    );

    this._room = null;

    this._frameRate = 30;
    this._lastRenderTime = 0;
    this._baseRenderTime = 0;
    this._renderNext = this._renderWrapper.bind(this);

    this._client.on('room.join', this._joinRoom, this);
    this._client.on('room.leave', this._leaveRoom, this);

    this.log('Created');

}

// Methods --------------------------------------------------------------------
Game.prototype = util.inherit(Emitter, {

    // Public Interface -------------------------------------------------------
    connect: function(port, hostname) {
        return this._client.connect();
    },

    setFrameRate: function(frameRate) {
        this._frameRate = frameRate;
    },

    setLogger: function(logger) {
        this._client.setLogger(logger);
        this._logger = logger;
    },

    close: function() {
        return this._client.close();
    },

    // Getters ----------------------------------------------------------------
    getClient: function() {
        return this._client;
    },

    getRoom: function() {
        return this._room;
    },

    getFrameRate: function() {
        return this._frameRate;
    },

    getTickCount: function() {
        return this._room ? this._room.getTickCount() : -1;
    },

    getTickRate: function() {
        return this._room ? this._room.getTickRate() : -1;
    },

    getTime: function() {
        return this.getTickCount() * Math.floor(1000 / this.getTickRate());
    },

    // Internal ---------------------------------------------------------------
    _load: function(room, deffered) {
        // Abstract
        deffered.resolve();
    },

    _loadWrapper: function(room, deffered) {
        this._load(room, deffered);
    },

    _tick: function(tick, players) {
        // Abstract
    },

    _tickWrapper: function(tick, players) {
        this._baseRenderTime = Date.now();
        this._tick(tick, players);
    },

    _render: function(last, next, u) {
        // Abstract
    },

    _renderWrapper: function() {

        if (this._isRendering) {

            window.requestAnimationFrame(this._renderNext);

            var now = Date.now(),
                perFrame = Math.floor(1000 / this._frameRate);

            if (now >= this._lastRenderTime + perFrame) {

                // "u" is the interpolation value between the last and next tick
                // time based on the current render time
                // e.g. if the render method is called exactly halfway between
                // two ticks u will be equal to 0.5
                // This can be used to smooth out animations and movements even
                // in case of very low tick rates by using velocities and
                // then calculating the position for each call to render via:
                //
                //     renderPosition = lastTickPosition + velocity * u
                //
                var time = this.getTime(),
                    perTick = Math.floor(1000 / this.getTickRate()),
                    u = 1 / perTick * (now - this._baseRenderTime);

                this._lastRenderTime = now;
                this._render(time, time + perTick, u);

            }

        }

    },

    _renderStart: function() {

        var now = Date.now();
        this._lastRenderTime = now;
        this._baseRenderTime = now;
        this._isRendering = true;
        this._renderWrapper();

    },

    _joinRoom: function(room) {
        this._room = room;
        room.once('start', this._startRoom, this);
        this.emit('render.start');
    },

    _startRoom: function() {
        this._renderStart();
    },

    _leaveRoom: function(room) {
        this.emit('render.stop');
    },

    // Logging ----------------------------------------------------------------
    log: function() {
        util.log(this._logger, this.toString(), arguments);
    },

    toString: function() {
        return '[ Game ' + this._client.getGameIdent()
                         + '@'
                         + this._client.getGameVersion() + ' ]';
    }

});

