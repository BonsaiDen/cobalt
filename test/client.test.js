// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var should = require('should'),
    util = require('./util'),
    Cobalt = require('../lib'),
    Promise = require('bluebird'),
    Deferred = Promise.defer().constructor;

// Tests ----------------------------------------------------------------------
describe('Cobalt', function() {

    describe('Client', function() {

        it('should create and destroy a Client instance', function() {

            var client = util.getClient('cobalt', '0.01');
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

        it('should handle failed connections attempts', function(done) {

            var client = util.getClient('cobalt', '0.01');

            util.getServer().close();

            client.connect(util.getPort(), 'localhost').then(function() {
                done(new Error('Should not succeed on failed connections'));

            }, function(byRemote) {
                byRemote.should.be.exactly(true);
                done();

            }).catch(done);

        });

        it('should handle server disconnects', function(done) {

            var client = util.getClient('cobalt', '0.01');

            client.connect(util.getPort(), 'localhost').then(function(cl) {

                client.on('close', function() {
                    client.isConnected().should.be.exactly(false);
                    done();
                });

                util.getServer().close();

            }).catch(done);

        });

        it('should be able to connect and disonnect from a server', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                event = false;

            client.isConnected().should.be.exactly(false);

            client.connect(util.getPort(), 'localhost').then(function(cl) {

                should(cl).be.instanceof(Cobalt.Client);
                should(cl).be.exactly(client);
                client.isConnected().should.be.exactly(true);

                client.on('close', function(byRemote) {
                    byRemote.should.be.exactly(false);
                    event = true;
                });

                return client.close();

            }).then(function(byRemote) {
                byRemote.should.be.exactly(false);
                client.isConnected().should.be.exactly(false);
                should(event).be.exactly(true);
                done();

            }).catch(done);

        });

        it('should login with a valid game identifier, game version and player name', function(done) {

            var client = util.getClient('cobalt', '0.01');

            client.connect(util.getPort(), 'localhost').then(function() {
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

        it('should handle server disconnects and destroy the local player', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                event = false;

            client.connect(util.getPort(), 'localhost').then(function(cl) {

                return client.login('Testuser');

            }).then(function(player) {

                player.on('destroy', function() {
                    event = true;
                });

                client.on('close', function() {
                    event.should.be.exactly(true);
                    client.isConnected().should.be.exactly(false);
                    done();
                });

                util.getServer().close();

            }).catch(done);

        });

        it('should create a new room, become the owner and set the room options', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                event = {
                    rooms: 0,
                    players: 0,
                    roomJoined: 0,
                    playerJoined: 0
                },
                rooms = client.getRooms();

            client.connect(util.getPort(), 'localhost').then(function() {

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

            var client = util.getClient('cobalt', '0.01', function loadHandler(params, deffered) {
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

            client.connect(util.getPort(), 'localhost').then(function() {
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

            var countdown = 1,
                events = {
                    start: 0,
                    update: 0,
                    end: 0
                };

            var client = util.getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                client.getRooms().at(0).getCountdown().should.be.exactly(0);
                deffered.resolve();

            }, function tickHandler(tick, players) {
                client.getRooms().at(0).getCountdown().should.be.exactly(-1);
                events.start.should.be.exactly(1);
                events.update.should.be.exactly(2);
                events.end.should.be.exactly(1);
                done();
            });

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 20);

            }).then(function(room) {

                room.on('countdown.start', function(c) {
                    c.should.be.exactly(countdown);
                    c.should.be.exactly(room.getCountdown());
                    events.start++;
                });

                room.on('countdown.update', function(c) {
                    c.should.be.exactly(countdown);
                    c.should.be.exactly(room.getCountdown());
                    events.update++;
                    countdown--;
                });

                room.on('countdown.end', function() {
                    room.getCountdown().should.be.exactly(-1);
                    events.end++;
                });

                return room.start(countdown).then(function(room) {
                    room.getCountdown().should.be.exactly(countdown);
                });

            }).catch(done);

        });

        it('should start a room with a countdown and allow the owner to cancel the countdown', function(done) {

            this.timeout(5000);

            var countdown = 2,
                events = {
                    start: 0,
                    update: 0,
                    cancel: 0,
                    end: 0
                };

            var client = util.getClient('cobalt', '0.01');

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 20);

            }).then(function(room) {

                room.on('countdown.start', function(c) {
                    c.should.be.exactly(countdown);
                    c.should.be.exactly(room.getCountdown());
                    events.start++;
                });

                room.on('countdown.update', function(c) {

                    c.should.be.exactly(countdown);
                    c.should.be.exactly(room.getCountdown());

                    events.update++;
                    countdown--;

                    room.cancel().then(function() {
                        events.update.should.be.exactly(1);
                        events.start.should.be.exactly(1);
                        events.cancel.should.be.exactly(1);
                        events.end.should.be.exactly(0);
                        done();

                    }, done).catch(done);

                });

                room.on('countdown.cancel', function() {
                    room.getCountdown().should.be.exactly(-1);
                    events.cancel++;
                });

                room.on('countdown.end', function() {
                    room.getCountdown().should.be.exactly(-1);
                    events.end++;
                });

                return room.start(countdown).then(function(room) {
                    room.getCountdown().should.be.exactly(countdown);
                });

            }).catch(done);

        });

        it('should start a room and correctly increase the ticks', function(done) {

            this.timeout(5000);

            var lastTick = -1;

            var client = util.getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                deffered.resolve();

            }, function tickHandler(tick, players) {

                should(tick - lastTick).be.exactly(1);
                lastTick = tick;

                if (tick === 257) {
                    done();
                }

            });

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 512);

            }).then(function(room) {
                return room.start(0);

            }).catch(done);

        });

        it('should handle server disconnects and stop / destroy the local room', function(done) {

            var events = {
                player: 0,
                leave: 0,
                room: 0
            };

            var client = util.getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                deffered.resolve();

            }, function tickHandler(tick, players) {

                client.getRooms().at(0).on('destroy', function() {
                    events.room++;
                });

                client.on('room.leave', function() {
                    events.leave++;
                });

                client.getPlayer().on('destroy', function() {
                    events.player++;
                });

                client.on('close', function(byRemote) {
                    byRemote.should.be.exactly(true);
                    events.leave.should.be.exactly(1);
                    events.room.should.be.exactly(1);
                    events.player.should.be.exactly(1);
                    client.isConnected().should.be.exactly(false);
                    done();
                });

                util.getServer().close();

            });

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 512);

            }).then(function(room) {
                return room.start(0);

            }).catch(done);

        });

        it('should leave a room', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                event = {
                    room: 0,
                    player: 0,
                    destroy: 0
                },
                rooms = client.getRooms();

            client.connect(util.getPort(), 'localhost').then(function() {
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

            var client = util.getClient('cobalt', '0.01'),
                room, other, otherRooms,
                events = {
                    join: 0,
                    players: 0,
                    update: 0
                };

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {
                room = r;
                other = util.getClient('cobalt', '0.01');
                otherRooms = other.getRooms();
                return other.connect(util.getPort(), 'localhost');

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

            var client = util.getClient('cobalt', '0.01', function loadHandler(params, deffered) {
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

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 30);

            }).then(function(room) {
                return room.start(0);

            }).catch(done);

        });

        it('should join a existing room with a password', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                other;

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20, 'passphrase');

            }).then(function(r) {
                other = util.getClient('cobalt', '0.01');
                return other.connect(util.getPort(), 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join('passphrase');

            }).then(function() {
                done();

            }).catch(done);

        });

        it('should fail to join a existing room with a incorrect password', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                room = null,
                other;

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20, 'passphrase');

            }).then(function(r) {
                room = r;
                other = util.getClient('cobalt', '0.01');
                return other.connect(util.getPort(), 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join('invalidpass');

            }).then(function() {
                done(new Error('Should not be able to join room with incorrect password.'));

            }, function(err) {
                err.should.be.instanceof(Cobalt.Client.Error);
                err.message.should.be.exactly('(48) ERROR_ROOM_INVALID_PASSWORD');
                err.code.should.be.exactly(Cobalt.Action.ERROR_ROOM_INVALID_PASSWORD);
                should(err.request).be.eql([room.getId(), 'invalidpass']);
                should(err.response).be.eql(null);
                done();

            }).catch(done);

        });

    });

});

