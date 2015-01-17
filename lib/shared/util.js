'use strict';

// Utilties -------------------------------------------------------------------
var util = {

    log: function(logger, instance, messages) {
        (logger || console.log)(
            instance + ' >> ' + Array.prototype.slice.call(messages).join('')
        );
    },

    generateRoomId: function() {
        return 'xx-xxxx-xxxx-xxxx'.replace(/x/g, function() {
            return Math.floor(Math.random() * 10);
        });
    },

    concat: function(id, separator, args) {
        return [id, separator].concat(Array.prototype.slice.call(args));
    },

    inherit: function(base, ext) {

        var proto = {},
            i;

        for(i in base.prototype) {
            if (base.prototype.hasOwnProperty(i)) {
                proto[i] = base.prototype[i];
            }
        }

        for(i in ext) {
            if (ext.hasOwnProperty(i)) {
                proto[i] = ext[i];
            }
        }

        return proto;

    },

    // Message Validation -----------------------------------------------------
    isValidMessage: function(msg) {
        return msg instanceof Array
            && msg.length === 3
            && util.isValidRespondId(msg[0])
            && util.isValidActionType(msg[1]);
    },

    isValidRespondId: function(id) {
        return typeof id === 'number'
            && !isNaN(id)
            && id >= 0;
    },

    isValidActionType: function(action) {
        return typeof action === 'number'
            && !isNaN(action)
            && action >= 0;
    },

    isValidVersion: function(version) {
        return (/\d+\.\d+/).test(version);
    },

    isValidGameIdent: function(ident) {
        return (/[0-9a-zA-Z_-]{4,12}/).test(ident);
    },

    isValidPlayerName: function(name) {
        return (/[0-9a-zA-Z_-]{3,16}/).test(name);
    },

    isValidRoomName: function(name) {
        return (/[0-9a-zA-Z_-]{3,16}/).test(name);
    },

    isValidRoomId: function(id) {
        return (/\d{2}\-\d{4}\-\d{4}\-\d{4}/).test(id);
    },

    isValidParameter: function(key, value) {
        return typeof key === 'string'
            && (/[0-9a-zA-Z_-]{1,16}/).test(key)
            && typeof value !== 'undefined';
    },

    isValidPassword: function(password) {
        return password === null || (/[0-9a-zA-Z_-]{1,16}/).test(password);
    },

    isValidPlayerCount: function(count, min, max) {
        return typeof count === 'number'
            && !isNaN(count)
            && count >= min
            && count <= max;
    },

    isValidTicksPerSecond: function(tps) {
        return typeof tps === 'number'
            && !isNaN(tps)
            && tps >= 1
            && tps <= 30; // TODO make this configurable
    },

    isValidCountdown: function(countdown) {
        return typeof countdown === 'number'
            && !isNaN(countdown)
            && countdown >= 0
            && countdown <= 10; // TODO make this configurable
    },

    isValidTickCount: function(tick) {
        return typeof tick === 'number'
            && !isNaN(tick)
            && tick >= 0;
    },

    isValidEventData: function(events) {
        return events instanceof Array
            && events.length < 32; // TODO make this configurable
    }

};


// Exports --------------------------------------------------------------------
module.exports = util;

