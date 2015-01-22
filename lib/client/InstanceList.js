'use strict';

// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var util = require('../shared/util'),
    Emitter = require('../shared/Emitter');


// Set based List Container ---------------------------------------------------
// ----------------------------------------------------------------------------
function InstanceList(parent, ctor) {

    Emitter.call(this);

    this._parent = parent;
    this._ids = [];
    this._instances = [];
    this._map = {};
    this._ctor = ctor;
    this.length = 0;

}

// Methods --------------------------------------------------------------------
InstanceList.prototype = util.inherit(Emitter, {

    // Public Interface -------------------------------------------------------
    update: function(items) {

        var seenIds = [],
            i, l, id;

        for(i = 0, l = items.length; i < l; i++) {

            id = items[i][0];

            // Add a new instance to the list
            if (!this._map.hasOwnProperty(id)) {
                this._add(id, items[i]);

            // Update the existing instance
            } else if (this._map.hasOwnProperty(id)) {
                var instance = this._map[id];
                instance.update.apply(instance, items[i]);
            }

            seenIds.push(id);

        }

        // Destroy all instances which are no longer containes in the items
        var ids = this._ids.slice();
        for(i = 0, l = ids.length; i < l; i++) {

            id = ids[i];

            if (seenIds.indexOf(id) === -1) {
                this._remove(id);
            }

        }

        this.emit('update');

    },

    clear: function() {

        this.emit('clear');

        var ids = this._ids.slice();
        for(var i = 0, l = ids.length; i < l; i++) {
            this._remove(ids[i]);
        }

    },

    destroy: function() {

        this.emit('destroy');
        this.clear();
        Emitter.prototype.destroy.call(this);

        this._instances = null;
        this._ids = null;
        this._map = null;
        this._ctor = null;

    },

    // Container Interface ----------------------------------------------------
    get: function(id) {
        return this._map[id];
    },

    at: function(index) {
        return this._instances[index];
    },

    forEach: function(callback) {
        this._instances.forEach(callback);
    },

    map: function(callback) {
        return this._instances.map(callback);
    },

    filter: function(callback) {
        return this._instances.filter(callback);
    },

    // Internal ---------------------------------------------------------------
    _add: function(id, item) {

        var instance = new this._ctor(this._parent);
        instance.update.apply(instance, item);

        this._map[id] = instance;
        this._instances.push(instance);
        this._ids.push(id);
        this.length++;

        this.emit('add', instance);

    },

    _remove: function(id) {

        var instance = this._map[id];

        this._instances.splice(this._instances.indexOf(instance), 1);
        this._ids.splice(this._ids.indexOf(id), 1);
        delete this._map[id];

        this.length--;

        this.emit('remove', instance);

        instance.destroy();

    }

});

// Exports --------------------------------------------------------------------
module.exports = InstanceList;

