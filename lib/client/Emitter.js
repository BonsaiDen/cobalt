'use strict';

// Event Emitter Mixing -------------------------------------------------------
// ----------------------------------------------------------------------------
function Emitter() {
    this._events = {};
}

// Methods --------------------------------------------------------------------
Emitter.prototype = {

    on: function(name, callback, scope, once) {

        var events = this._events[name];
        if (!events) {
            events = (this._events[name] = []);
        }

        events.push({
            callback: callback,
            scope: scope || this,
            once: once,
            fired: false
        });

        return callback;

    },

    once: function(name, callback, scope) {
        return this.on(name, callback, scope, true);
    },

    emit: function(name) {

        var id = name,
            events = this._events[id],
            stopped = false;

        if (events) {

            var call = Function.prototype.call;

            // Create a shallow copy to protect against unbinds
            // from within the callbacks
            var sliced = events.slice();
            for(var i = 0, l = sliced.length; i < l; i++) {

                var event = events[i];
                if (!event.once || !event.fired) {

                    event.fired = true;

                    var args = Array.prototype.slice.call(arguments);
                    args[0] = event.scope || this;
                    stopped = call.apply(event.callback, args) || stopped;

                }

                if (event.once) {
                    events.splice(i, 1);
                    i--;
                    l--;
                }

            }

        }

        return stopped;

    },

    unbind: function(name, func) {

        if (typeof name === 'function') {
            name = null;
            func = name;
        }

        if (name) {

            if (func) {

                var events = this._events[name];
                if (events) {

                    for(var i = 0, l = events.length; i < l; i++) {

                        if (events[i].callback === func) {
                            events.splice(i, 1);
                            i--;
                            l--;
                        }

                    }

                }

            } else {
                delete this._events[name];
            }

        } else {

            for(var e in this._events) {
                if (this._events.hasOwnProperty(e)) {
                    this.unbind(e, func);
                }
            }

        }

    },

    destroy: function() {
        this.unbind();
        this._events = null;
    }

};

// Export ---------------------------------------------------------------------
module.exports = Emitter;

