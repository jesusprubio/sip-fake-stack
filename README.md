# sip-fake-stack

A fake (and incomplete!) SIP stack I use in different security projects. Some features:
- More less ;) valid SIP packet to avoid blocking following [RFC 3261](http://www.ietf.org/rfc/rfc3261.txt) and its extensions
- TLS, IPv6
- SIP over WS(S) support ([RFC 7118](https://tools.ietf.org/html/rfc7118))
- Partial [SIP Torture](https://tools.ietf.org/html/rfc4475)
- Supported requests: REGISTER, INVITE, OPTIONS, MESSAGE, BYE, CANCEL, ACK, Trying, Ringing, OK, SUBSCRIBE, NOTIFY, PUBLISH


## Install
- It's not in the NPM repo since it's not ready to use in production. BTW you can install it from there:
`npm i -g git+https://github.com/jesusprubio/sip-fake-stack.git`

## Use
- [Examples](examples)

## Issues
- Please use GitHub web (https://github.com/assaultjs/assaultjs-geolocation/issues). If you have doubts playing with the software label the issue as "question".

## Developer guide
- To contribute we use [GitHub pull requests](https://help.github.com/articles/using-pull-requests).
- Conventions:
 - We use [JSHint](http://jshint.com/) and [Crockford's Styleguide](http://javascript.crockford.com/code.html).
 - Please run `grunt contribute` to be sure your code fits with them.

