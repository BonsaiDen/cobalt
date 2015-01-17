'use strict';

// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var Action = require('../shared/Action');


// Cobalt Error Class ---------------------------------------------------------
// ----------------------------------------------------------------------------
function CobaltError(code, response) {
    this.name = 'CobaltError';
    this.code = code;
    this.message = '(' + code + ') ' + Action.getNameFromId(code);
    this.response = response;
    this.request = null;
}

CobaltError.prototype = Object.create(Error.prototype);


// Exports --------------------------------------------------------------------
module.exports = CobaltError;

