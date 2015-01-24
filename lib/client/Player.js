'use strict';

// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var util = require('../shared/util'),
    Emitter = require('../shared/Emitter');


// Local Player Abstraction ---------------------------------------------------
// ----------------------------------------------------------------------------
function Player(client) {

    Emitter.call(this);

    this._client = client;
    this._id = null;
    this._name = null;
    this._randomIndex = null;
    this._isOwner = false;
    this._receivedEvents = [];

}

// Methods --------------------------------------------------------------------
util.inherit(Player, Emitter, {

    // Public Interface -------------------------------------------------------
    send: function(event) {
        if (this === this._client.getPlayer()) {
            this._client.$addPlayerEvent(event);
        }
    },

    setOwner: function() {
        return this._client.$setRoomOwner(this);
    },

    destroy: function() {

        this.emit('destroy');
        Emitter.prototype.destroy.call(this);

        this._client = null;
        this._id = null;
        this._name = null;
        this._isOwner = null;
        this._receivedEvents = null;

    },

    // Container Interface ----------------------------------------------------
    update: function(id, name) {
        this._id = id;
        this._name = name;
        this.emit('update');
    },

    // Getters ----------------------------------------------------------------
    getId: function() {
        return this._id;
    },

    getName: function() {
        return this._name;
    },

    getEvents: function() {
        return this._receivedEvents;
    },

    getRandomIndex: function() {
        return this._randomIndex;
    },

    isOwnerOfRoom: function() {
        return this._isOwner;
    },

    // Internal ---------------------------------------------------------------
    $setOwner: function(isOwner) {
        this._isOwner = isOwner;
        this.log('Is now owner of room');
        this.emit('owner', isOwner);
    },

    $setRandomIndex: function(index) {
        this._randomIndex = index;
    },

    $resetReceivedEvents: function() {
        this._receivedEvents.length = 0;
    },

    $addReceivedEvent: function(event) {
        this._receivedEvents.push(event);
    },

    // Logging ----------------------------------------------------------------
    log: function() {
        this._client.log.apply(
            this._client,
            util.concat(this.toString(), ' >> ', arguments)
        );
    },

    toString: function() {
        return '[ Player #' + this._id + ' "' + this._name
                + '"' + (this.isOwnerOfRoom() ? ' (Owner)' : '') + ' ]';
    }

});

// Exports --------------------------------------------------------------------
module.exports = Player;

