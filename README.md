Cobalt - Minimal Lockstep Game Server 
-------------------------------------

Cobalt is JavaScript based, minimal client / server framework for creating games based on the
[lockstep protocol](http://en.wikipedia.org/wiki/Lockstep_protocol).

It serves as game independent messaging server between the clients.


## Features

- Player login (TODO: Add OAuth Support)
- Room creation (with optional password support)
- Room ownership management
- Game specific room settings (TickRate, Min / Max Players)
- Ability to let players define custom room parameters (e.g. choose map, select their colors)
- Automatic synchronisation of room and player lists
- Room countdowns
- Client side loading and tick callbacks
- Event distribution between players / clients in-game


## Upcoming Features

__General__

- Add support for room owners to alter min / max player count after room creation

    - Kick superflous players from the room

- Add support for kicking / banning players from the room
    - Add support for banning from rooms via IP

- Add support for the owner to cancel the room countdown 

- Add support for players needing to mark themselves as ready before countdown can be started

    - Make this an option at room creation

__Client__

- Add game abstraction base class that implements rendering and tick callback methods


__Server__

- Add support to white/blacklist certain gameidents and versions


## Usage / Installation / Dependencies

### Server

You'll need either [io.js](https://iojs.org/) or [Node.js](https://nodejs.org) installed.


Creating a server is straigtforward:

    var server = new Cobalt.Server();
    server.listen(port);


### Client

The client depends on [bluebird](https://github.com/petkaantonov/bluebird/) promise library.

Creating a client for a game named `mygame` at version `0.01`:

    var client = getClient('mygame', '0.01');

    client.connect(port, 'localhost').then(function() {

    });

## Documentation

Work in Progress. For now, please refer to the unit tests to get an idea how things work.


## Licensed under MIT

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see http://www.gnu.org/licenses/.

