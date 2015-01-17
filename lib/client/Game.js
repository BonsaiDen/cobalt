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
        gameIdent, gameVersion, playerClass, roomClass
    );

}

// Methods --------------------------------------------------------------------
Game.prototype = util.inherit(Emitter, {

    // Public Interface -------------------------------------------------------
    connect: function(port, hostname) {
        return this._client.connect();
    },

    close: function() {
        return this._client.close();
    },

    // Getters ----------------------------------------------------------------
    getClient: function() {
        return this._client;
    },

    // Internal ---------------------------------------------------------------
    _load: function(room, deffered) {
        deffered.resolve();
    },

    _tick: function(tick, players) {

    },

    _render: function(last, next, u) {
        // TODO setup request animation frame with interpolation factor
        // and start / stop it on room start / leaving
    },

    // Logging ----------------------------------------------------------------
    log: function() {
        util.log(this._logger, this.toString(), arguments);
    },

    toString: function() {
        return '[ Game ' + this._hostname + ':' + this._port + ' ]';
    }

});

// Exports --------------------------------------------------------------------
module.exports = Game;

