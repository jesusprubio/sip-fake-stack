/*
  Copyright Jesús Pérez <jesusprubio@gmail.com>

  This code may only be used under the MIT license found at
  https://opensource.org/licenses/MIT.
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
                transport: self.transport.toUpperCase(),
                lport: self.lport,
                timeout: self.timeout,
                wsProto: 'sip',
                wsPath: self.wsPath
            },
            msgOptions = cfg,
            allRes = [],
            returned = false;

        // Reusing options object
        msgOptions.lport = self.lport;
        msgOptions.server = self.server;
        msgOptions.srcHost = self.srcHost;
        msgOptions.domain = self.domain;
        msgOptions.transport = self.transport.toUpperCase();

        self.metaSocket = new SteroidsSocket(socketCfg);

        self.metaSocket.on('error', function (err) {
            callback({
                message: 'Generic socket error',
                error: err
            });
        });

        self.metaSocket.on('message', function (msg) {

            if (!self.onlyFirst) {
                self.metaSocket.close();
                callback(null, {
                    msg : msg
                });

                return;
            }
            if (!returned) {
                returned = true;
                // We wait for a while for more responses
                setTimeout(function () {
                    self.metaSocket.close();
                    callback(null, {
                        message : 'Received responses:',
                        data: allRes
                    });
                }, Math.round(self.timeout / 3));
            }

            // SIP can be a binary or text protocol, but text widely used
            allRes.push(msg.data.toString());
        });

        self.metaSocket.send(utils.createMessage(msgOptions));
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
                transport: self.transport.toUpperCase(),
                lport: self.lport,
                timeout: self.timeout,
                wsProto: 'sip',
                wsPath: self.wsPath
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
        msgOptions.transport = self.transport.toUpperCase();

        self.metaSocket = new SteroidsSocket(socketCfg);

        self.metaSocket.on('error', function (err) {
            console.log('ERR');
            console.log(err);
            callback({
                message: 'Generic socket error, second time: ' + !firstTime,
                error: err
            });
        });

        self.metaSocket.on('message', function (msg) {
            var lastMessage = 'Not accepted',
                response, resCode, parsedAuth;

            // TODO: We need to be more polite at the end of this function
            // (send ACKs, etc.) to avoid retryings
            self.metaSocket.close();

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

                    self.metaSocket.close(); // just in case

                    return;
                } else if (resCode === '200') {
                    callback(null, {
                        message: 'User without authentication',
                        data: {
                            valid: true,
                            response: response
                        }
                    });
                    self.metaSocket.close();

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

                self.metaSocket.send(utils.createMessage(msgOptions));
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

        self.metaSocket.send(utils.createMessage(msgOptions));
    }

    // TODO: Error: address in use if a huge actives.
    // if (!this.lport) {
    //     randomPort(function (port) {
    //         self.lport = port;
    //         authenticateLport();
    //     });
    // } else {
    authenticateLport();
    // }

};

module.exports = SipFakeStack;
// We expose also the rest of the stuff just in case
module.exports.parser = sipParser;
module.exports.utils = utils;
module.exports.SteroidsSocket = SteroidsSocket;
