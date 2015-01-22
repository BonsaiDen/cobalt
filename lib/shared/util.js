'use strict';

// Utilties -------------------------------------------------------------------
var util = {

    // Logging Abstraction ----------------------------------------------------
    log: function(logger, instance, messages) {
        (logger || util._log)(
            instance + ' >> ' + Array.prototype.slice.call(messages).join('')
        );
    },

    _log: function(message) {
        console.log(message);
    },

    concat: function(id, separator, args) {
        return [id, separator].concat(Array.prototype.slice.call(args));
    },


    // Generic Helpers --------------------------------------------------------
    generateRoomId: function() {
        return 'xx-xxxx-xxxx-xxxx'.replace(/x/g, function() {
            return Math.floor(Math.random() * 10);
        });
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

    merge: function(config, defaults) {

        for(var i in defaults) {
            if (defaults.hasOwnProperty(i)) {
                if (!config.hasOwnProperty(i)) {
                    config[i] = defaults[i];
                }
            }
        }

        return config;

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

    isValidPlayerCount: function(count, config) {
        return typeof count === 'number'
            && !isNaN(count)
            && count >= config.minRoomPlayers
            && count <= config.maxRoomPlayers;
    },

    isValidTicksPerSecond: function(tps, config) {
        return typeof tps === 'number'
            && !isNaN(tps)
            && tps >= config.minTicksPerSecond
            && tps <= config.maxTicksPerSecond;
    },

    isValidCountdown: function(countdown, config) {
        return typeof countdown === 'number'
            && !isNaN(countdown)
            && countdown >= config.minCountdown
            && countdown <= config.maxCountdown;
    },

    isValidTickCount: function(tick) {
        return tick >= 0 && tick <= 255;
    },

    isValidEventData: function(events, config) {
        return events instanceof Array;
    }

};


// Exports --------------------------------------------------------------------
module.exports = util;

