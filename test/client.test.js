// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var should = require('should'),
    net = require('net'),
    Cobalt = require('../lib'),
    Promise = require('bluebird'),
    Deferred = Promise.defer().constructor,
    WebSocket = require('websocket').w3cwebsocket,
    server = null,
    clients = [],
    port = 0;


// Setup ----------------------------------------------------------------------
global.WebSocket = WebSocket;

function getPort() {

    // Get an unused port by binding to 0 which makes the kernel select a
    // free port
    // This will not re-use previously ports acquired via this method unless it
    // absolutely has to (i.e. there is no other open port left)
    var s = new net.Server();
    s.listen(0);

    // Then unbind from the port, this will cause it to stay open until
    // someone else binds to it explictly.
    var port = s.address().port;
    s.close();

    return port;

}

function getClient(gameIdent, gameVersion, loadHandler, tickHandler) {

    var client = new Cobalt.Client(
        gameIdent, gameVersion, null, null, loadHandler, tickHandler
    );

    client.setLogger(function() {});
    clients.push(client);

    return client;

}

beforeEach(function() {
    port = getPort();
    server = new Cobalt.Server({
        maxTicksPerSecond: 512
    });
    server.setLogger(function() {});
    server.listen(port);
});

afterEach(function(done) {

    server.close();
    server = null;

    clients.forEach(function(client) {
        client.close().then(function() {
        }, function() {
        });
    });

    clients.length = 0;

    setTimeout(done);

});


// Tests ----------------------------------------------------------------------
describe('Cobalt', function() {

    describe('Client', function() {

        it('should create and destroy a Client instance', function() {

            var client = getClient('cobalt', '0.01');
            client.should.be.instanceof(Cobalt.Client);

            client.getGameIdent().should.be.exactly('cobalt');
            client.getGameVersion().should.be.exactly('0.01');

            var event = false;
            client.on('destroy', function() {
                event = true;
            });

            client.destroy();

            should(event).be.exactly(true);

        });

        it('should be able to connect and disonnect from a server', function(done) {

            var client = getClient('cobalt', '0.01'),
                event = false;

            client.isConnected().should.be.exactly(false);

            client.connect(port, 'localhost').then(function(cl) {

                should(cl).be.instanceof(Cobalt.Client);
                should(cl).be.exactly(client);
                client.isConnected().should.be.exactly(true);

                client.on('close', function() {
                    event = true;
                });

                return client.close();

            }).then(function(status) {
                client.isConnected().should.be.exactly(false);
                should(event).be.exactly(true);
                done();

            }).catch(done);

        });

        it('should login with a valid game identifier, game version and player name', function(done) {

            var client = getClient('cobalt', '0.01');

            client.connect(port, 'localhost').then(function() {
                should(client.getPlayer()).be.exactly(null);
                return client.login('Testuser');

            }).then(function(player) {
                should(player).instanceof(Cobalt.Client.Player);
                player.should.be.exactly(client.getPlayer());
                player.getId().should.be.type('number');
                player.getName().should.be.exactly('Testuser');
                client.getRooms().should.have.length(0);
                player.should.be.exactly(client.getPlayer());
                done();

            }).catch(done);

        });

        it('should create a new room, become the owner and set the room options', function(done) {

            var client = getClient('cobalt', '0.01'),
                event = {
                    rooms: 0,
                    players: 0,
                    roomJoined: 0,
                    playerJoined: 0
                },
                rooms = client.getRooms();

            client.connect(port, 'localhost').then(function() {

                client.once('rooms', function(rooms) {
                    rooms.should.have.length(0);
                    event.rooms++;
                });

                return client.login('Testuser');

            }).then(function() {

                should(event.rooms).be.exactly(1);
                rooms.should.have.length(0);

                client.once('rooms', function(rooms) {
                    rooms.should.have.length(1);
                    event.rooms++;
                });

                client.once('players', function(players) {
                    players.should.have.length(1);
                    event.players++;
                });

                client.once('room.join', function(room) {
                    room.should.be.exactly(client.getRooms().at(0));
                    event.roomJoined++;
                });

                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(room) {

                should(event.rooms).be.exactly(2);
                should(event.roomJoined).be.exactly(1);
                should(event.players).be.exactly(1);

                should(room).instanceof(Cobalt.Client.Room);
                room.getName().should.be.exactly('Testroom');
                room.getOwner().should.be.exactly(client.getPlayer());
                client.getPlayer().isOwnerOfRoom().should.be.exactly(true);
                room.getMinPlayerCount().should.be.exactly(2);
                room.getMaxPlayerCount().should.be.exactly(8);
                room.getTickRate().should.be.exactly(20);

                client.getPlayers().should.have.length(1);
                client.getPlayers().at(0).should.be.exactly(client.getPlayer());

                rooms.should.have.length(1);
                rooms.at(0).should.be.exactly(room);

                done();

            }).catch(done);

        });

        it('should directly start a room without any countdown and run the load and tick handlers', function(done) {

            var client = getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                should(params).instanceof(Object);
                should(deffered).instanceof(Deferred);
                deffered.resolve();

            }, function tickHandler(tick, players) {

                should(event).be.exactly(1);
                client.getRooms().at(0).getSeed().should.be.a.Number;
                client.getRooms().at(0).isStarted().should.be.exactly(true);
                tick.should.be.exactly(0);
                client.getRooms().at(0).getTickCount().should.be.exactly(0);
                players.should.have.length(1);

                var events = players.at(0).getEvents();

                should(events).instanceof(Array);
                events.should.have.length(0);

                done();

            });

            var event = 0;

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 20);

            }).then(function(room) {

                room.on('start', function() {
                    event++;
                });

                return room.start(0).then(function(room) {
                    should(room).instanceof(Cobalt.Client.Room);
                    room.should.be.exactly(room);
                });

            }).catch(done);

        });

        it('should start a room with a countdown and emit the corresponding events', function(done) {

            this.timeout(5000);

            var countdown = 1;
            var client = getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                client.getRooms().at(0).getCountdown().should.be.exactly(0);
                deffered.resolve();

            }, function tickHandler(tick, players) {
                done();
            });

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 20);

            }).then(function(room) {

                room.on('countdown', function(c) {
                    c.should.be.exactly(countdown);
                    c.should.be.exactly(room.getCountdown());
                    countdown--;
                });

                return room.start(countdown).then(function(room) {
                    room.getCountdown().should.be.exactly(-1);
                });

            }).catch(done);

        });

        it('should start a room and correctly increase the ticks', function(done) {

            this.timeout(5000);

            var lastTick = -1;

            var client = getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                deffered.resolve();

            }, function tickHandler(tick, players) {

                should(tick - lastTick).be.exactly(1);
                lastTick = tick;

                if (tick === 513) {
                    done();
                }

            });

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 512);

            }).then(function(room) {
                return room.start(0);

            }).catch(done);

        });

        it('should leave a room', function(done) {

            var client = getClient('cobalt', '0.01'),
                event = {
                    room: 0,
                    player: 0,
                    destroy: 0
                },
                rooms = client.getRooms();

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                client.getPlayers().should.have.length(1);
                return client.createRoom('Testroom', 1, 8, 20);

            }).then(function(room) {

                client.on('room.leave', function() {
                    event.room++;
                });

                room.on('player.leave', function() {
                    event.player++;
                });

                room.on('destroy', function() {
                    event.destroy++;
                });

                return room.leave();

            }).then(function(p) {

                event.room.should.be.exactly(1);
                event.player.should.be.exactly(1);
                event.destroy.should.be.exactly(1);

                should(p).instanceof(Cobalt.Client.Player);
                should(p).be.exactly(client.getPlayer());
                client.getPlayer().isOwnerOfRoom().should.be.exactly(false);
                rooms.should.have.length(0);
                done();

            }).catch(done);

        });

        it('should join a existing room', function(done) {

            var client = getClient('cobalt', '0.01'),
                room, other, otherRooms,
                events = {
                    join: 0,
                    players: 0,
                    update: 0
                };

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {
                room = r;
                other = getClient('cobalt', '0.01');
                otherRooms = other.getRooms();
                return other.connect(port, 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {

                client.on('players', function(players) {
                    players.should.have.length(2);
                    events.players++;
                });

                client.getPlayers().on('update', function() {
                    events.update++;
                });

                room.on('player.join', function(player) {
                    player.should.be.instanceof(Cobalt.Client.Player);
                    events.join++;
                });

                otherRooms.should.have.length(1);
                otherRooms.at(0).getPlayerCount().should.be.exactly(1);
                return otherRooms.at(0).join();

            }).then(function(otherRoom) {

                events.join.should.be.exactly(1);
                events.players.should.be.exactly(1);
                events.update.should.be.exactly(1);
                should(otherRoom).instanceof(Cobalt.Client.Room);

                otherRoom.getName().should.be.exactly('Testroom');
                otherRoom.getOwner().getId().should.be.exactly(client.getPlayer().getId());
                other.getPlayer().isOwnerOfRoom().should.be.exactly(false);

                otherRoom.getMinPlayerCount().should.be.exactly(2);
                otherRoom.getMaxPlayerCount().should.be.exactly(8);
                otherRoom.getTickRate().should.be.exactly(20);

                otherRoom.getPlayerCount().should.be.exactly(2);
                room.getPlayerCount().should.be.exactly(2);

                done();

            }).catch(done);

        });

        it('should send player events and receive them back on the next tick in a started room', function(done) {

            var client = getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                deffered.resolve();

            }, function tickHandler(tick, players) {

                var events = players.at(0).getEvents();

                client.getRooms().at(0).getTickCount().should.be.exactly(tick);

                if (tick === 0) {
                    should(events).instanceof(Array);
                    events.should.have.length(0);
                    client.getPlayer().send({ action: 'click' });

                } else if (tick === 1) {
                    should(events).instanceof(Array);
                    events.should.have.length(1);
                    events[0].should.be.eql({ action: 'click' });
                    client.getPlayer().send({ action: 'move' });
                    client.getPlayer().send({ action: 'select' });

                } else if (tick === 2) {
                    should(events).instanceof(Array);
                    events.should.have.length(2);
                    events[0].should.be.eql({ action: 'move' });
                    events[1].should.be.eql({ action: 'select' });

                } else if (tick === 3) {
                    should(events).instanceof(Array);
                    events.should.have.length(0);
                    done();
                }

            });

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 30);

            }).then(function(room) {
                return room.start(0);

            }).catch(done);

        });

        it('should join a existing room with a password', function(done) {

            var client = getClient('cobalt', '0.01'),
                other;

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20, 'passphrase');

            }).then(function(r) {
                other = getClient('cobalt', '0.01');
                return other.connect(port, 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join('passphrase');

            }).then(function() {
                done();

            }).catch(done);

        });

        it('should fail to join a existing room with a incorrect password', function(done) {

            var client = getClient('cobalt', '0.01'),
                room = null,
                other;

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20, 'passphrase');

            }).then(function(r) {
                room = r;
                other = getClient('cobalt', '0.01');
                return other.connect(port, 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join('invalidpass');

            }).then(function() {
                done(new Error('Should not be able to join room with incorrect password.'));

            }, function(err) {
                err.should.be.instanceof(Cobalt.Client.Error);
                err.message.should.be.exactly('(43) ERROR_ROOM_INVALID_PASSWORD');
                err.code.should.be.exactly(Cobalt.Action.ERROR_ROOM_INVALID_PASSWORD);
                should(err.request).be.eql([room.getId(), 'invalidpass']);
                should(err.response).be.eql(null);
                done();

            }).catch(done);

        });

    });

    describe('Server', function() {

        it('should allow the current room owner to set another player as the new owner', function(done) {

            var client = getClient('cobalt', '0.01'),
                events = {
                    roomOwner: 0,
                    player: 0
                },
                room,
                other,
                otherRoom,
                clientOtherPlayer,
                otherClientPlayer;

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {
                room = r;
                other = getClient('cobalt', '0.01');
                return other.connect(port, 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join();

            }).then(function(r) {

                otherRoom = r;

                clientOtherPlayer = client.getPlayers().at(1);
                otherClientPlayer = other.getPlayers().at(1);

                client.getPlayers().at(0).once('owner', function(isOwner) {
                    should(isOwner).be.exactly(false);
                    events.player++;
                });

                clientOtherPlayer.once('owner', function(isOwner) {
                    should(isOwner).be.exactly(true);
                    events.player++;
                });

                other.getPlayers().at(0).once('owner', function(isOwner) {
                    should(isOwner).be.exactly(true);
                    events.player++;
                });

                otherClientPlayer.once('owner', function(isOwner) {
                    should(isOwner).be.exactly(false);
                    events.player++;
                });

                otherRoom.once('owner', function(p) {
                    p.should.be.exactly(other.getPlayers().at(0));
                    events.roomOwner++;
                });

                room.once('owner', function(p) {
                    p.should.be.exactly(client.getPlayers().at(1));
                    events.roomOwner++;
                });

                return room.setOwner(clientOtherPlayer);

            }).then(function() {

                events.player.should.be.exactly(4);
                events.roomOwner.should.be.exactly(2);

                // check owner reference of the room
                room.getOwner().should.be.exactly(clientOtherPlayer);
                otherRoom.getOwner().should.be.exactly(other.getPlayer());

                // check ownership of the players
                clientOtherPlayer.isOwnerOfRoom().should.be.exactly(true);
                client.getPlayer().isOwnerOfRoom().should.be.exactly(false);

                other.getPlayer().isOwnerOfRoom().should.be.exactly(true);
                otherClientPlayer.isOwnerOfRoom().should.be.exactly(false);

                // set back
                return otherClientPlayer.setOwner();

            }).then(function() {

                // check owner reference of the room
                room.getOwner().should.be.exactly(client.getPlayer());
                otherRoom.getOwner().should.be.exactly(otherClientPlayer);

                // check ownership of the players
                clientOtherPlayer.isOwnerOfRoom().should.be.exactly(false);
                client.getPlayer().isOwnerOfRoom().should.be.exactly(true);

                other.getPlayer().isOwnerOfRoom().should.be.exactly(false);
                otherClientPlayer.isOwnerOfRoom().should.be.exactly(true);

                done();

            }).catch(done);

        });

        it('should assign a new owner if the current one leaves the room', function(done) {

            var client = getClient('cobalt', '0.01'),
                room, other, events = {
                    leave: 0
                };

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {
                room = r;
                other = getClient('cobalt', '0.01');
                return other.connect(port, 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join();

            }).then(function(otherRoom) {

                other.getPlayer().on('owner', function(isOwner) {
                    events.leave.should.be.exactly(1);
                    other.getPlayer().isOwnerOfRoom().should.be.exactly(true);
                    isOwner.should.be.exactly(true);
                    done();
                });

                other.getRooms().at(0).on('player.leave', function(player) {
                    player.should.be.instanceof(Cobalt.Client.Player);
                    events.leave++;
                });

                return room.leave();

            }).then(function() {
                client.getPlayer().isOwnerOfRoom().should.be.exactly(false);

            }).catch(done);

        });

        it('should allow any player to set room parameters and send the parameters to newly joined players', function(done) {

            var client = getClient('cobalt', '0.01'),
                events = {
                    parameter: 0
                },
                room,
                other,
                clientOtherPlayer,
                otherClientPlayer;

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {

                room = r;
                room.once('parameter', function(key, value) {
                    key.should.be.exactly('name');
                    value.should.be.exactly('Lancelot');
                    events.parameter++;
                });

                return room.setParameter('name', 'Lancelot');

            }).then(function() {

                events.parameter.should.be.exactly(1);

                room.getParameters().should.be.eql({
                    name: 'Lancelot'
                });

                room.once('parameter', function(key, value) {
                    key.should.be.exactly('color');
                    value.should.be.exactly('blue');
                    events.parameter++;
                });

                return room.setParameter('color', 'blue');

            }).then(function() {

                events.parameter.should.be.exactly(2);

                room.getParameters().should.be.eql({
                    name: 'Lancelot',
                    color: 'blue'
                });

                other = getClient('cobalt', '0.01');
                return other.connect(port, 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join();

            }).then(function(otherRoom) {

                otherRoom.getParameters().should.be.eql({
                    name: 'Lancelot',
                    color: 'blue'
                });

                clientOtherPlayer = client.getPlayers().at(1);
                otherClientPlayer = other.getPlayers().at(1);
                // TODO test starting the room and see if params
                // are passed to loadHandler
                done();

            }).catch(done);

        });

        it('should allow the owner to change the password of an existing room', function(done) {

            var client = getClient('cobalt', '0.01'),
                other;

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20, 'passphrase');

            }).then(function() {
                return client.getRooms().at(0).setPassword('otherpass');

            }).then(function(r) {
                other = getClient('cobalt', '0.01');
                return other.connect(port, 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join('otherpass');

            }).then(function() {
                done();

            }).catch(done);

        });


        it('should update the player list after a player left', function(done) {

            var client = getClient('cobalt', '0.01'),
                room, other, events = {
                    left: 0,
                    update: 0,
                    destroy: 0,
                    players: 0
                };

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {
                room = r;
                other = getClient('cobalt', '0.01');
                return other.connect(port, 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join();

            }).then(function(otherRoom) {

                client.getPlayers().on('update', function() {
                    client.getPlayers().should.have.length(1);
                    events.update++;
                });

                client.on('players', function(players) {
                    players.should.have.length(1);
                    events.players++;
                });

                other.getPlayers().on('update', function() {
                    other.getPlayers().should.have.length(1);
                    events.update++;
                });

                other.getPlayers().at(1).on('destroy', function() {
                    events.destroy++;
                });

                // this will be the last event in the whole chain
                other.on('players', function(players) {

                    players.should.have.length(1);
                    events.players++;

                    events.update.should.be.exactly(2);
                    events.players.should.be.exactly(2);
                    events.left.should.be.exactly(1);
                    events.destroy.should.be.exactly(1);
                    done();

                });

                return room.leave();

            }).then(function() {
                events.left++;

            }).catch(done);

        });

        it('should limit then number of events a player can send per tick', function(done) {

            var client = getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                deffered.resolve();

            }, function tickHandler(tick, players) {

                var events = players.at(0).getEvents();

                client.getRooms().at(0).getTickCount().should.be.exactly(tick);

                if (tick === 0) {
                    should(events).instanceof(Array);
                    events.should.have.length(0);
                    client.getPlayer().send({ action: '1' });
                    client.getPlayer().send({ action: '2' });
                    client.getPlayer().send({ action: '3' });
                    client.getPlayer().send({ action: '4' });
                    client.getPlayer().send({ action: '5' });
                    client.getPlayer().send({ action: '6' });
                    client.getPlayer().send({ action: '7' });
                    client.getPlayer().send({ action: '8' });
                    client.getPlayer().send({ action: '9' });

                } else if (tick === 1) {
                    should(events).instanceof(Array);
                    events.should.have.length(8);
                    events[0].should.be.eql({ action: '1' });
                    events[1].should.be.eql({ action: '2' });
                    events[2].should.be.eql({ action: '3' });
                    events[3].should.be.eql({ action: '4' });
                    events[4].should.be.eql({ action: '5' });
                    events[5].should.be.eql({ action: '6' });
                    events[6].should.be.eql({ action: '7' });
                    events[7].should.be.eql({ action: '8' });
                    done();
                }

            });

            client.connect(port, 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 30);

            }).then(function(room) {
                return room.start(0);

            }).catch(done);

        });

    });

});

