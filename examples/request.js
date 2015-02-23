#!/usr/bin/env node

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

//var sipStack = require('sip-fake-stack'),
var SipStack = require('../'),
    stackCfg, msgCfg, fakeStack;


stackCfg = {
    server: '172.16.190.128',
    port: '5060',
    transport: 'UDP', // UDP, TCP, TLS, WS, WSS
    timeout: 3000
//    wsPath: '/ws', // only when WS(S)
//    tlsType: 'TLSv1', // only when TLS
//    srcHost: 192.168.1.9
//    lport: 5000,
//    domain: jssip.net
};
fakeStack = new SipStack(stackCfg);

msgCfg = {
    meth: 'REGISTER'
//	print: true
};
fakeStack.send(msgCfg, function (err, res) {
    if (err) {
        console.log('Error:');
        console.log(err);
    } else {
        console.log('Result:');
        // All responses are returned in an array
        console.log(res);
    }

    process.exit(0);
});
