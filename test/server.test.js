// Dependencies ---------------------------------------------------------------
// ----------------------------------------------------------------------------
var should = require('should'),
    util = require('./util'),
    Cobalt = require('../lib'),
    Promise = require('bluebird');

// Tests ----------------------------------------------------------------------
describe('Cobalt', function() {

    describe('Server', function() {

        it('should allow the current room owner to set another player as the new owner', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                events = {
                    roomOwner: 0,
                    player: 0
                },
                room,
                other,
                otherRoom,
                clientOtherPlayer,
                otherClientPlayer;

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {
                room = r;
                other = util.getClient('cobalt', '0.01');
                return other.connect(util.getPort(), 'localhost');

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

            var client = util.getClient('cobalt', '0.01'),
                room, other, events = {
                    leave: 0
                };

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {
                room = r;
                other = util.getClient('cobalt', '0.01');
                return other.connect(util.getPort(), 'localhost');

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

            var client = util.getClient('cobalt', '0.01'),
                events = {
                    parameter: 0
                },
                room,
                other,
                clientOtherPlayer,
                otherClientPlayer;

            client.connect(util.getPort(), 'localhost').then(function() {
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

                other = util.getClient('cobalt', '0.01');
                return other.connect(util.getPort(), 'localhost');

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

            var client = util.getClient('cobalt', '0.01'),
                other;

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20, 'passphrase');

            }).then(function() {
                return client.getRooms().at(0).setPassword('otherpass');

            }).then(function(r) {
                other = util.getClient('cobalt', '0.01');
                return other.connect(util.getPort(), 'localhost');

            }).then(function() {
                return other.login('Otheruser');

            }).then(function() {
                return other.getRooms().at(0).join('otherpass');

            }).then(function() {
                done();

            }).catch(done);

        });


        it('should update the player list after a player left', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                room, other, events = {
                    left: 0,
                    update: 0,
                    destroy: 0,
                    players: 0
                };

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function() {
                return client.createRoom('Testroom', 2, 8, 20);

            }).then(function(r) {
                room = r;
                other = util.getClient('cobalt', '0.01');
                return other.connect(util.getPort(), 'localhost');

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

            var client = util.getClient('cobalt', '0.01', function loadHandler(params, deffered) {
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

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 30);

            }).then(function(room) {
                return room.start(0);

            }).catch(done);

        });

        it('should only allow unique player names', function(done) {

            var client = util.getClient('cobalt', '0.01'),
                other = util.getClient('cobalt', '0.01');

            client.connect(util.getPort(), 'localhost').then(function(cl) {
                return client.login('PlayerName');

            }).then(function() {
                return other.connect(util.getPort(), 'localhost');

            }).then(function() {
                return other.login('PlayerName');

            }).then(function() {
                done(new Error('Should not be able to join the server with a player name that is already in use.'));

            }, function(err) {
                err.should.be.instanceof(Cobalt.Client.Error);
                err.message.should.be.exactly('(49) ERROR_SERVER_NAME_IN_USE');
                err.code.should.be.exactly(Cobalt.Action.ERROR_SERVER_NAME_IN_USE);
                should(err.request).be.eql(['0.1', 'cobalt', '0.01', 'PlayerName']);
                should(err.response).be.eql(null);
                done();

            }).catch(done);

        });

        it('should not allow setting any parameters after a room was started', function(done) {

            var client = util.getClient('cobalt', '0.01', function loadHandler(params, deffered) {
                deffered.resolve();

            }, function tickHandler(tick, players) {

                if (tick === 0) {

                    client.getRooms().at(0).setParameter('key', 'value').then(function() {
                        done(new Error('Should not be able to set parameters on a started room'));

                    }, function(err) {
                        err.should.be.instanceof(Cobalt.Client.Error);
                        err.message.should.be.exactly('(40) ERROR_ROOM_STARTED');
                        err.code.should.be.exactly(Cobalt.Action.ERROR_ROOM_STARTED);
                        should(err.request).be.eql(['key', 'value']);
                        should(err.response).be.eql(null);
                        done();

                    }).catch(function() {
                        done();
                    });

                }

            });

            client.connect(util.getPort(), 'localhost').then(function() {
                return client.login('Testuser');

            }).then(function(player) {
                return client.createRoom('Testroom', 1, 8, 512);

            }).then(function(room) {
                return room.start(0);

            }).catch(function() {
                done();
            });

        });

        it('should limit the number of players which can simutaneously login', function(done) {

            var a = util.getClient('cobalt', '0.01'),
                b = util.getClient('cobalt', '0.01'),
                c = util.getClient('cobalt', '0.01');

            Promise.all([
                a.connect(util.getPort(), 'localhost'),
                b.connect(util.getPort(), 'localhost'),
                c.connect(util.getPort(), 'localhost')

            ]).then(function() {

                return Promise.all([
                    a.login('User1'),
                    b.login('User2')

                ]).then(function() {
                    return c.login('User3').then(function() {
                        done(new Error('Should not allow a third user to login'));

                    }, function(err) {
                        err.should.be.instanceof(Cobalt.Client.Error);
                        err.message.should.be.exactly('(51) ERROR_SERVER_MAX_PLAYERS');
                        err.code.should.be.exactly(Cobalt.Action.ERROR_SERVER_MAX_PLAYERS);
                        should(err.request).be.eql(['0.1', 'cobalt', '0.01', 'User3']);
                        should(err.response).be.eql(null);
                        done();
                    });
                });

            }).catch(done);

        });

        it('should limit the number of rooms which can be open at once', function(done) {

            var a = util.getClient('cobalt', '0.01'),
                b = util.getClient('cobalt', '0.01');

            Promise.all([
                a.connect(util.getPort(), 'localhost'),
                b.connect(util.getPort(), 'localhost'),

            ]).then(function() {
                return Promise.all([
                    a.login('User1'),
                    b.login('User2')
                ]);

            }).then(function() {
                return a.createRoom('Testroom', 2, 8, 20);

            }).then(function() {
                return b.createRoom('Testroom', 2, 7, 20);

            }).then(function() {
                done(new Error('Should not allow a second room to be created'));

            }, function(err) {
                err.should.be.instanceof(Cobalt.Client.Error);
                err.message.should.be.exactly('(52) ERROR_SERVER_MAX_ROOMS');
                err.code.should.be.exactly(Cobalt.Action.ERROR_SERVER_MAX_ROOMS);
                should(err.request).be.eql(['Testroom', 2, 7, 20, null]);
                should(err.response).be.eql(null);
                done();

            }).catch(done);

        });

        it('should drop idle connections which do not perform a login within a given timeframe', function(done) {

            this.timeout(250);

            var client = util.getClient('cobalt', '0.01');
            client.connect(util.getPort(), 'localhost').then(function() {
                client.on('close', function(byRemote) {
                    byRemote.should.be.exactly(true);
                    done();
                });
            });
        });

        // TODO test all sorts of action response errors and handling of invalid
        // messages

    });

});


