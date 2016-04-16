var config      = require('./config');

var log4js      = require('./log');
var logger      = log4js.getLogger("UTILS", "DEBUG");

const fs        = require('fs');
var crypto      = require('crypto');


exports.encodePassword = function(clearPassword, cb) {
    var salt = crypto.randomBytes(128).toString('base64');
    var iter = 1000;
    crypto.pbkdf2(clearPassword, salt, iter, 512, function(err, derivedKey) {
        cb(salt+":"+iter+":"+derivedKey.toString('base64'));
    });
};

exports.verifyPassword = function(clearPassword, encPassword, cb) {
    var p = encPassword.split(":");
    if (p.length == 3) {
        var salt = p[0];
        var iter = parseInt(p[1]);
        var hash = p[2];
        crypto.pbkdf2(clearPassword, salt, iter, 512, function (err, derivedKey) {
            cb(derivedKey.toString("base64") === hash);
        });
    }
    else
        cb(false);
};
