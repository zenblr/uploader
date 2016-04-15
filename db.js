var config = require('./config');

var log4js          = require('./log');
var logger          = log4js.getLogger("DB", "DEBUG");

var MongoClient     = require('mongodb').MongoClient;
var url             = 'mongodb://localhost:27017/SdkRunnerDb';

var db = {};
db.open = function(cb) {
    MongoClient.connect(url, function (err, db) {
        if (err == null) {
            return cb(db);
        }
        else {
            logger.error("Failed to open db.");
        }
    });
}

module.exports = db;
