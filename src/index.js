/*
    Copyright Jesus Perez <jesusprubio gmail com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';


// Private stuff
var net = require('net'),
    randomPort = require('random-port'),

    utils = require('./utils'),
    SteroidsSocket = require('./steroidsSocket'),
    sipParser = require('./parser');


// Constructor

function SipFakeStack(config) {

    if (!config.server) {
        throw '(SipFakeStack) You need at least to specify a valid IPv4/6 target';
    }

    this.server = config.server || null;
    this.port = config.port || 5060;
    this.transport = config.transport || 'UDP';
//    this.lport = config.lport || utils.randomPort();
    this.lport = config.lport || null;
    this.srcHost = config.srcHost;
    this.timeout = config.timeout || 8000;
    this.wsPath = config.wsPath || null;
    this.tlsType = config.tlsType || 'SSLv3';
    this.domain = config.domain || null;
    this.onlyFirst = config.onlyFirst || true;

    if (net.isIPv6(config.server) && !config.srcHost) {
        this.srcHost = utils.randomIP6();
    } else if (!config.srcHost) {
        this.srcHost = utils.randomIP();
    }
}


// Public functions

SipFakeStack.prototype.send = function (cfg, callback) {
    var self = this;

    function sendLport() {
        var socketCfg = {
                target: self.server,
                port: self.port,
                transport: self.transport,
                lport: self.lport,
                timeout: self.timeout,
                wsProto: 'sip',
                wsPath: self.wsPath,
                tlsType: self.tlsType
            },
            msgOptions = cfg,
            allRes = [],
            returned = false;

        // Reusing options object
        msgOptions.lport = self.lport;
        msgOptions.server = self.server;
        msgOptions.srcHost = self.srcHost;
        msgOptions.domain = self.domain;
        msgOptions.transport = self.transport;

        self.megaSocket = new SteroidsSocket(socketCfg);

        self.megaSocket.on('error', function (err) {
            callback({
                message: 'Generic socket error',
                error: err
            });
        });

        self.megaSocket.on('message', function (msg) {

            if (!self.onlyFirst) {
                self.megaSocket.close();
                callback(null, {
                    msg : msg
                });

                return;
            }
            if (!returned) {
                returned = true;
                // We wait for a while for more responses
                setTimeout(function () {
                    self.megaSocket.close();
                    callback(null, {
                        message : 'Received responses:',
                        data: allRes
                    });
                }, Math.round(self.timeout / 3));
            }

            // SIP can be a binary or text protocol, but text widely used
            allRes.push(msg.data.toString());
        });

        self.megaSocket.send(utils.createMessage(msgOptions));
    }

    // Trick needed to avoid problem with bussy ports in UDP (EADDINUSE)
    if (!this.lport) {
        randomPort(function (port) {
            self.lport = port;
            sendLport();
        });
    } else {
        sendLport();
    }
};

SipFakeStack.prototype.authenticate = function (config, callback) {
    var self = this;

    function authenticateLport() {
        var msgOptions = config,
            firstTime = true,
            valid = false,
            // We need to know this values in advance to continue the transaction
            cseq = 1,
            callId = utils.randomString(16),
            toExt = utils.randomString(3),
            // in case of webscokets
            gruuInstance = 'urn:uuid:' + utils.randomString(3) + '-' +
                            utils.randomString(4) + '-' + utils.randomString(8),
            socketCfg = {
                target: self.server,
                port: self.port,
                transport: self.transport,
                lport: self.lport,
                timeout: self.timeout,
                wsProto: 'sip',
                wsPath: self.wsPath,
                tlsType: self.tlsType
            };

        // Reusing options object
        msgOptions.lport = self.lport;
        msgOptions.server = self.server;
        msgOptions.srcHost = self.srcHost;
        msgOptions.domain = self.domain;
        msgOptions.cseq = cseq;
        msgOptions.callId = callId;
        msgOptions.toExt = toExt;
        msgOptions.gruuInstance = gruuInstance;

        self.megaSocket = new SteroidsSocket(socketCfg);

        self.megaSocket.on('error', function (err) {
            callback({
                message: 'Generic socket error, second time: ' + !firstTime,
                error: err
            });
        });

        self.megaSocket.on('message', function (msg) {
            var lastMessage = 'Not accepted',
                response, resCode, parsedAuth;

            // TODO: We need to be more polite at the end of this function
            // (send ACKs, etc.) to avoid retryings
            self.megaSocket.close();

            if (!(msg && msg.data)) {
                callback({
                    message: 'Empty message, firstTime: ' + firstTime,
                    error: null
                });

                return;
            }
            // SIP can be a binary or text protocol, but text widely used
            response = msg.data.toString();
            resCode = sipParser.code(response);

            if (firstTime) {
                firstTime = false;
                if (['401', '407', '200'].indexOf(resCode) === -1) {
                    callback(null, {
                        message: 'Not expected SIP code (1st res.)',
                        data: {
                            valid: false,
                            response: response
                        }
                    });

                    self.megaSocket.close(); // just in case

                    return;
                } else if (resCode === '200') {
                    callback(null, {
                        message: 'User without authentication',
                        data: {
                            valid: true,
                            response: response
                        }
                    });
                    self.megaSocket.close();

                    return;
                }
                // Upgrading SIP fields
                parsedAuth = sipParser.realmNonce(response);
                if (!parsedAuth) {
                    callback(null, {
                        message: 'Not expected SIP code (2nd res.)',
                        data: {
                            valid: false,
                            response: response
                        }
                    });

                    return;
                }
                msgOptions.isProxy = parsedAuth.isProxy;
                msgOptions.realm = parsedAuth.realm;
                msgOptions.nonce = parsedAuth.nonce;
                msgOptions.pass = config.pass;
                msgOptions.cseq = cseq + 1;

                self.megaSocket.send(utils.createMessage(msgOptions));
            } else { // second time
                if (['REGISTER', 'PUBLISH'].indexOf(config.meth) !== -1) {
                    if (resCode === '200') {
                        valid = true;
                        lastMessage = 'Accepted';
                    }
                } else if (['401', '407'].indexOf(resCode) === -1) {
                    valid = true;
                    lastMessage = 'Accepted';
                }
                callback(null, {
                    message: lastMessage,
                    data: {
                        valid: valid,
                        response: response
                    }
                });
            }
        });

        self.megaSocket.send(utils.createMessage(msgOptions));
    }

    if (!this.lport) {
        randomPort(function (port) {
            self.lport = port;
            authenticateLport();
        });
    } else {
        authenticateLport();
    }

};

module.exports = SipFakeStack;
// We expose also the rest of the stuff just in case
module.exports.parser = sipParser;
module.exports.utils = utils;
module.exports.steroidSocket = SteroidsSocket;
