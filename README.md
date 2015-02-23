# assaultjs-geolocation
A fake and incomplete! SIP stack I use in some security projects. It implements (more ore less ;) valid SIP packet following [RFC 3261](http://www.ietf.org/rfc/rfc3261.txt) and its extensions. Some features:
- RFC compliant to avoid blocking ([RFC 3261](https://www.ietf.org/rfc/rfc3261.txt)
- TLS, IPv6
- SIP over WS(S) support ([RFC 7118](https://tools.ietf.org/html/rfc7118))
- Partial [SIP Torture](https://tools.ietf.org/html/rfc4475)
- Supported requests: REGISTER, INVITE, OPTIONS, MESSAGE, BYE, CANCEL, ACK, Trying, Ringing, OK, SUBSCRIBE, NOTIFY, PUBLISH


## Install
- It's not in the NPM repo since it's nor ready to use in production. BTW you can install it from there:
`npm i -g git+https://github.com/jesusprubio/sip-fake-stack.git`

## Use
Visit the code in the ["examples"](examples) folder.

## Issues
- Please use GitHub web (https://github.com/assaultjs/assaultjs-geolocation/issues). If you have doubts playing with the software label the issue as "question".

## Developer guide
- To contribute we use [GitHub pull requests](https://help.github.com/articles/using-pull-requests).
- Conventions:
 - We use [JSHint](http://jshint.com/) and [Crockford's Styleguide](http://javascript.crockford.com/code.html).
 - Please run `grunt contribute` to be sure your code fits with them.

## License
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