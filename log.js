var config = require('./config');
var log4js = require('log4js');

log4js.configure({
    appenders: [
    {
        type: "file",
        filename: config.log.file,
        maxLogSize: 50*1024,
        backups: 5,
        category: ['APP', 'DB', 'UTILS']
    },
    {
        type: "console"
    }],
    replaceConsole: true
});
var logger = { 
   getLogger: function(name, level) {
		var l = log4js.getLogger(name);
		l.setLevel(level.toUpperCase());
		return l;
   }
};

module.exports = logger;
