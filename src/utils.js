/*
  Copyright Jesús Pérez <jesusprubio@gmail.com>

  This code may only be used under the MIT license found at
  https://opensource.org/licenses/MIT.
*/

// Some helpers

'use strict';


// Private stuff

var net = require('net'),
    crypto = require('crypto'),
    lodash = require('lodash'),

    SIP_REQS = [
        'REGISTER', 'INVITE', 'OPTIONS', 'MESSAGE', 'BYE', 'CANCEL', 'ACK',
        'Trying', 'Ringing', 'OK', 'SUBSCRIBE', 'NOTIFY', 'PUBLISH'
    ];


// Helpers

function getDigest(cfg) {
    var ha1, ha2, response;

    ha1 = crypto.createHash('md5').update(cfg.fromExt + ':' + cfg.realm +
                                          ':' + cfg.pass).digest('hex');
    ha2 = crypto.createHash('md5').update(cfg.meth + ':' +
                                          cfg.authUri).digest('hex');
//    console.log(cfg);
//    console.log('HA1: ' + cfg.fromExt + ':' + cfg.realm + ':' + cfg.pass)
//    console.log('HA1MD5:'+ ha1);
//    console.log('HA2: ' + cfg.meth + ':' + cfg.authUri);
//    console.log('HA2MD5:'+ ha2);

    response = crypto.createHash('md5').update(
        ha1 + ':' + cfg.nonce + ':' + ha2).digest('hex');
//    console.log('response: ' + ha1 + ':' + cfg.nonce + ':' + ha2);
//    console.log('responseMD5: ' + response );
    return response;
}

function randomString(length, base) {
    var id = '';

    if (length === null) {
        length = 8;
    }
    if (base === null) {
        base = 36;
    }

    while (id.length < length) {
        id += Math.random().toString(base).substr(2);
    }

    return id.substr(0, length);
}

function randomIP() {
    var array = [],
        i;

    for (i = 0; i <= 3; i += 1) {
        array.push(lodash.random(1, 255));
    }

    return array.join('.');
}

function randomIP6() {
    var array = [],
        i;

    for (i = 0; i <= 7; i += 1) {
        array.push(randomString(4, 16));
    }

    return array.join(':');
}

function randomPort() {
    return lodash.random(1025, 65535);
}


// Public stuff

module.exports.randomString = randomString;

module.exports.randomIP = randomIP;

module.exports.randomIP6 = randomIP6;

module.exports.randomPort = randomPort;

module.exports.randSipReq = function () {
    return SIP_REQS[lodash.random(11)];
};

module.exports.getSipReqs = function () {
    return SIP_REQS;
};

module.exports.createMessage = function (options) {
    // We allow to rewrite all fields externally, we are in a security tool!
    var server = options.server || null,
        domain = options.domain || options.server,
        toExt = options.toExt || randomString(3),
        fromExt = options.fromExt || randomString(3),
        srcHost = options.srcHost || randomIP(),
        srcPort = options.lport || randomPort(),
        branchPad = options.branchPad || randomString(30),
        cseq = options.cseq || 1,
        sessionId = options.sessionId || lodash.random(1000000000, 9999999999),
        sessionPort = options.sessionPort || lodash.random(1025, 65535),
        isProxy = options.isProxy || false,
        fromTag = options.fromTag || randomString(10),
        toTag = options.toTag || randomString(10),
        callId = options.callId || randomString(16),
        tupleId = options.tupleId || randomString(10),
        regId = options.regId || 1,
        gruuInstance = options.gruuInstance || ('urn:uuid:' + (randomString(3)) + '-' +
                                            (randomString(4)) + '-' + (randomString(8))),
        expires = options.expires || '3600',
        meth = options.meth || 'REGISTER',
        transport = options.transport || 'UDP',
        realm = options.realm || null,
        nonce = options.nonce || null,
        pass = options.pass || null,
        ipVersion = '4',
        targetUri = 'sip:' + domain,
        userAgent = options.userAgent || 'bluebox-scanner',
        maxForwards = options.maxForwards || '70',
        sipAccept = options.sipAccept || 'application/sdp',
        sipDate = options.sipDate || null,
        sipVersion = options.sipVersion || '2.0',
        badSeparator = options.badSeparator || false,
        badFields = options.badFields || false,
        print = options.print || false,

        contentType, contentLen, sipMessage, uriVia, uri, toUri,
        authUri, response, sdp, digestCfg;

    // Getting derivated params
    if (net.isIPv6(options.server)) {
        ipVersion = '6';
        server = '[' + server + ']';
        srcHost = options.srcHost || randomIP6();
        srcHost = '[' + srcHost + ']';
        if (net.isIPv6(domain)) {
            domain = '[' + domain + ']';
        }
    }
    if (meth === 'REGISTER') {
        toExt = fromExt;
    }
    uriVia = srcHost + ':' + srcPort;
    uri = 'sip:' + fromExt + '@' + domain;
    toUri = 'sip:' + toExt + '@' + domain;
//    toUriVia = 'sip:' + toExt + '@' + domain;
    targetUri = 'sip:' + domain;

    // SIP frame is filled from here

    // First line
    if (!badFields) { // SIP Torture
        switch (meth) {
            case 'REGISTER':
            case 'PUBLISH':
                sipMessage = meth + ' ' + targetUri + ' SIP/' + sipVersion + '\r\n';
                break;
            case 'OK':
                sipMessage = 'SIP/' + sipVersion + ' 200 OK\r\n';
                break;
            case 'Ringing':
                sipMessage = 'SIP/' + sipVersion + ' 180 Ringing\r\n';
                break;
            default:
                sipMessage = meth + ' ' + toUri + ' SIP/' + sipVersion + '\r\n';
        }
    } else {
        sipMessage = '';
    }
    // Via
    switch (transport) {
        case 'WS':
        case 'WSS':
            uriVia = '' + randomString(12) + '.invalid';
    }
    sipMessage += 'Via: SIP/' + sipVersion + '/' + transport.toUpperCase() + ' ' +
        uriVia + ';branch=z9hG4bK' + branchPad;
    if (badSeparator) {
        sipMessage += ';;,;,,';
    }
    sipMessage += '\r\n';

    // From
    sipMessage += 'From: ' + fromExt + ' <' + uri + '>;tag=' + fromTag + '\r\n';
    // To
    switch (meth) {
        case 'REGISTER':
        case 'PUBLISH':
            sipMessage += 'To: <' + uri + '>\r\n';
            break;
        case 'INVITE':
        case 'OPTIONS':
        case 'MESSAGE':
        case 'CANCEL':
        case 'SUBSCRIBE':
        case 'NOTIFY':
            sipMessage += 'To: ' + toExt + ' <' + toUri + '>\r\n';
            break;
        default:
            sipMessage += 'To: ' + toExt + ' <' + toUri + '>;tag=' + toTag + '\r\n';
    }
    // Call-ID
    sipMessage += 'Call-ID: ' + callId + '@' + domain + '\r\n';
    // Cseq
    switch (meth) {
        case 'Trying':
        case 'Ringing':
        case 'OK':
            sipMessage += 'CSeq: ' + cseq + ' INVITE\r\n';
            break;
        default:
            sipMessage += 'CSeq: ' + cseq + ' ' + meth + '\r\n';
    }
    // Max-forwards
    sipMessage += 'Max-Forwards: ' + maxForwards + '\r\n';
    // Allow
    switch (meth) {
        case 'REGISTER':
        case 'INVITE':
        case 'MESSAGE':
        case 'SUBSCRIBE':
        case 'PUBLISH':
        case 'NOTIFY':
            sipMessage += 'Allow: REGISTER, INVITE, OPTIONS, ACK, CANCEL, BYE, MESSAGE, SUBSCRIBE, PUBLISH, NOTIFY\r\n';
    }
    // Supported
    switch (transport) {
        case 'WS':
        case 'WSS':
            sipMessage += 'Supported: path, outbound, gruu\r\n';
    }
    // User-Agent
    sipMessage += 'User-Agent: ' + userAgent;
    if (badSeparator) {
        sipMessage += ';;,;,,';
    }
    sipMessage += '\r\n';
    // Date
    if (sipDate) {
        sipMessage += 'Date: ' + sipDate + '\r\n';
    }

    // Presence
    switch (meth) {
        case 'SUBSCRIBE':
        case 'PUBLISH':
            sipMessage += 'Expires: 2600\r\n';
    }
    switch (meth) {
        case 'SUBSCRIBE':
        case 'PUBLISH':
        case 'NOTIFY':
            sipMessage += 'Event: presence\r\n';
    }
    // Contact
    if (transport === 'WS' || transport === 'WSS') {
        switch (meth) {
            case 'REGISTER':
            case 'OPTIONS':
            case 'PUBLISH':
            case 'SUBSCRIBE':
                sipMessage += 'Contact: <sip:' + fromExt + '@' + uriVia +
                    ';transport=ws;expires=' + expires + '>';
                sipMessage += ';reg-id=' + regId + ';sip.instance="<' +
                    gruuInstance + '>"\r\n';
                break;
            case 'INVITE':
            case 'MESSAGE':
            case 'OK':
            case 'Ringing':
            case 'NOTIFY':
            case 'CANCEL':
                sipMessage += 'Contact: <sip:' + fromExt + '@' + domain;
                sipMessage += ';gr=' + gruuInstance + ';ob>\r\n';
        }
    } else {
        switch (meth) {
            case 'REGISTER':
                sipMessage += 'Contact: <sip:' + fromExt + '@' + uriVia + '>;expires=' + expires + '\r\n';
                break;
            case 'OPTIONS':
            case 'PUBLISH':
            case 'SUBSCRIBE':
                sipMessage += 'Contact: <sip:' + fromExt + '@' + uriVia + '>\r\n';
                break;
            case 'INVITE':
            case 'MESSAGE':
            case 'OK':
            case 'Ringing':
            case 'NOTIFY':
            case 'CANCEL':
                if (transport === 'TLS') {
                    transport = 'TCP';
                }
                if (transport === 'WSS') {
                    transport = 'WS';
                }
                sipMessage += 'Contact: <sip:' + fromExt + '@' + uriVia +
                    ';transport=' + (transport.toLowerCase()) + '>\r\n';
        }
    }
    // Challenge
    if (realm && nonce && pass) {
        if (isProxy) {
            sipMessage += 'Proxy-Authorization:';
        } else {
            sipMessage += 'Authorization:';
        }
        switch (meth) {
            case 'REGISTER':
            case 'PUBLISH':
                authUri = targetUri;
                break;
            case 'INVITE':
            case 'OPTIONS':
            case 'MESSAGE':
            case 'OK':
            case 'Ringing':
            case 'NOTIFY':
            case 'CANCEL':
            case 'SUBSCRIBE':
                authUri = toUri;
        }
        digestCfg = {
            fromExt: fromExt,
            realm: realm,
            pass: pass,
            meth: meth,
            authUri: authUri,
            nonce: nonce
        };

        response = getDigest(digestCfg);
        sipMessage += ' Digest username="' + fromExt + '", realm="' + realm + '"';
        if (options.sqli) {
            sipMessage += 'UNION SELECT FROM subscriber WHERE username=' + fromExt +
                          ' and realm="' + domain + '"';
        }
        sipMessage += ',nonce="' + nonce + '", uri="' + authUri + '", response="' +
                        response + '", algorithm=MD5\r\n';
    }
    // Content-type and content
    switch (meth) {
        case 'INVITE':
        case 'OK':
            sdp = 'v=0\r\n';
            sdp += 'o=' + fromExt + ' ' + sessionId + ' ' + sessionId + ' IN IP' +
                ipVersion + ' ' + srcHost + '\r\n';
            sdp += 's=-\r\n';
            sdp += 'c=IN IP' + ipVersion + ' ' + srcHost + '\r\n';
            sdp += 't=0 0\r\n';
            sdp += 'm=audio ' + sessionPort + ' RTP/AVP 0\r\n';
            sdp += 'a=rtpmap:0 PCMU/8000\r\n';
            contentType = options.contentType || 'application/sdp';
            sipMessage += 'Content-Type: ' + contentType + '\r\n';

            contentLen = options.contentLen || sdp.length;
            sipMessage += 'Content-Length: ' + contentLen + '\r\n\r\n';
            sipMessage += sdp;
            break;
        case 'MESSAGE':
            sdp = 'OLA K ASE! ;)\r\n';
            contentType = options.contentType || 'text/plain';
            sipMessage += 'Content-Type: ' + contentType + '\r\n';
            contentLen = options.contentLen || sdp.length;
            sipMessage += 'Content-Length: ' + contentLen + '\r\n\r\n';
            sipMessage += sdp;
            break;
        case 'NOTIFY':
        case 'PUBLISH':
            sdp = '<presence xmlns="urn:ietf:params:xml:ns:pidf" ';
            sdp += 'entity="sip:' + toExt + '@' + domain + '">\r\n';
            sdp += '<tuple id="' + tupleId + '">\r\n';
            sdp += '<status>\r\n';
            sdp += '<basic>open</basic>\r\n';
            sdp += '</status>\r\n';
            sdp += '<contact priority="0.8">' + toExt + '@' + domain + '</contact>\r\n';
            sdp += '</tuple>\r\n';
            sdp += '</presence>\r\n';
            contentType = options.contentType || 'application/pidf+xml';
            sipMessage += 'Content-Type: ' + contentType + '\r\n';
            contentLen = options.contentLen || sdp.length;
            sipMessage += 'Content-Length: ' + contentLen + '\r\n\r\n';
            sipMessage += sdp;
            break;
        default:
            if (meth === 'OPTIONS') {
                sipMessage += 'Accept: ' + sipAccept + '\r\n';
            }
            contentLen = options.contentLen || '0';
            sipMessage += 'Content-Length: ' + contentLen + '\r\n\r\n';
    }

    if (print) {
        console.log(sipMessage);
    }

    return sipMessage;
};
