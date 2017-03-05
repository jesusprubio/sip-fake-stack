/*
  Copyright Jesús Pérez <jesusprubio@gmail.com>

  This code may only be used under the MIT license found at
  https://opensource.org/licenses/MIT.
*/

// Different transports wrapper to allow to open a connection over
// UDP, TCP, TLS, WS or WSS in a transparent way.
// TODO: For now it only works as a client able to send (and receive) stuff!

'use strict';


// Private stuff

var dgram = require('dgram'),
    net = require('net'),
    tls = require('tls'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    WebSocketClient = require('websocket').client;


// Helpers

function addZeros(block) {
    if (block === '') {
        return '0';
    } else {
        return block;
    }
}

function normalize6(add6) {
    var normalizedAdd, splittedAdd, i;

    normalizedAdd = [];
    splittedAdd = add6.split(':');

    for (i = 0; i < splittedAdd.length; i += 1) {
        i = splittedAdd[i];
        normalizedAdd.push(addZeros(i));
    }

    return normalizedAdd.join(':');
}


// Public stuff

// Constructor

function SteroidsSocket(options) {
    var finalTarget;

    if (options.target && net.isIPv6(options.target)) {
        finalTarget = normalize6(options.target);
    } else {
        finalTarget = options.target;
    }

    this.target = finalTarget;
    this.port = options.port || 80;
    this.transport = options.transport || 'TCP';
    this.lport = options.lport || null;
    this.timeout = options.timeout || 8000;
    this.allowHalfOpen = options.allowHalfOpen || null;
    this.wsProto = options.wsProto || 'sip';
    this.wsPath = options.wsPath || null;

    // We init the socket in the send function to be able
    // to detect timeouts using UDP (no "received" or similar event)
}
// We're going to use the Node EventEmitter
util.inherits(SteroidsSocket, EventEmitter);

// Methods

SteroidsSocket.prototype.send = function (msg) {
    var self = this,
        // This var is to control of our timeout error
        received = false,
        wsError = false,
        protocols;

    // The libraries don't support any close function, so we need this
    // to emulate it. 
    function timeoutCb() {
        if (!received) {
            self.emit('error', {
				type: 'socket: timeout',
				data: 'Connection problem: No response'
			});
        }
		// Websockets Node module doen't support any close function, we're using the client
		// https://github.com/Worlize/WebSocket-Node/blob/master/lib/WebSocketClient.js
		// So we need this var to "emulate" it and avoid returning multiple errors
        wsError = true;

        // We're closing the socket manually, so we need this to avoid errors
        self.close();
    }

    protocols = {
        'UDP': function () {
            if (net.isIPv6(self.target)) {
                self.metaSocket = dgram.createSocket('udp6');
            } else {
                self.metaSocket = dgram.createSocket('udp4');
            }

            self.metaSocket.on('error', function (err) {
                received = true; // to avoid the launch of our timeout error
                self.emit('error', {
                    type: 'socket',
                    data: err
                });
            });

            self.metaSocket.on('closed', function () {
                self.emit('closed');
            });

            self.metaSocket.on('message', function (msg, rinfo) {
                received = true;
                self.emit('message', {
                    type: 'received',
                    data: msg,
                    rinfo: rinfo
                });
            });

            // "connect" listener
            self.metaSocket.bind(self.lport, function () {
                var buff = new Buffer(msg);

                setTimeout(timeoutCb, self.timeout);
                self.metaSocket.send(
                    buff,
                    0,
                    buff.length,
                    self.port,
                    self.target
                );
            });
        },
        'TCP': function (isSecure) {
            function listenCb() {
                self.metaSocket.write(msg);
                // TODO: Another timeout and event (no response)
                // should be also generated
            }

            setTimeout(timeoutCb, self.timeout);

            if (!isSecure) {
                self.metaSocket = net.connect(
                    {
                        host: self.target,
                        port: self.port,
                        // if true, the socket won't automatically send a FIN
                        // packet when the other end of the socket sends a FIN
                        // packet. Defaults to false, usefull to flood
                        allowHalfOpen: self.allowHalfOpen
        //                localAddress: ''
                    },
                    listenCb // 'connect listener'
                );
            } else {
                self.metaSocket = tls.connect(
    // http://nodejs.org/api/tls.html#tls_tls_connect_port_host_options_callback
                    {
                        host: self.target,
                        port: self.port,
                        rejectUnauthorized: false
                    },
                    listenCb // 'connect listener'
                );
            }
            self.metaSocket.on('error', function (err) {
                received = true; // to avoid the launch of our timeout error
                self.emit('error', {
                    type: 'socket',
                    data: err.toString()
                });
            });

            self.metaSocket.on('end', function () {
                self.emit({
                    type: 'socket closed'
                });
            });

            self.metaSocket.on('data', function (data) {
                received = true;
                self.emit('message', {
                    type: 'received',
                    data: data
                });
            });
        },
        'TLS': function () {
            protocols.TCP(true);
        },
        'WS': function () {
            var addr = self.transport.toLowerCase() +
                '://' + self.target + ':' + self.port;

            if (self.wsPath) {
                addr += '/' + self.wsPath;
            }
            self.metaSocket = new WebSocketClient({
                tlsOptions: {
                    rejectUnauthorized : false
                }
            });

            setTimeout(timeoutCb, self.timeout);

            self.metaSocket.on('connectFailed', function (err) {
                received = true; // to avoid the launch of our timeout error
                if (!wsError) {
                    self.emit('error', {
                        type: 'socket: connectFailed',
                        data: err.toString()
                    });
                }
            });

            self.metaSocket.on('connect', function (connection) {
                connection.on('error', function (err) {
                    // To avoid returning multiple errors, see the comments
                    // in "callback" function
                    if (!wsError) {
                        self.emit('error', {
                            type: 'socket',
                            data: err
                        });
                    }
                });

                connection.on('close', function () {
                    self.emit('closed');
                });

                connection.on('message', function (message) {
                    received = true;
                    self.emit('message', {
                        type: 'received',
                        data: message.utf8Data
                    });
                });

                connection.sendUTF(msg);
            });

            self.metaSocket.connect(addr, 'sip');
        },
        'WSS': function () {
            protocols.WS();
        }
    };

    if (!this.target) {
        self.emit('error', {
            type: 'params',
            data: 'You need to specify a valid IPv4/6 target'
        });

        return;
    }
    if (!protocols[this.transport]) {
        self.emit('error', {
            type: 'Transport not found'
        });

        return;
    }
    protocols[this.transport]();
};

SteroidsSocket.prototype.close = function () {
    try {
        if (this.transport === 'TCP' || this.transport === 'TLS') {
            this.metaSocket.destroy();
        } else if (this.transport === 'UDP') {
            this.metaSocket.close();
        }
    } catch (err) {} // do nothing, only to avoid crashing
};


module.exports = SteroidsSocket;
