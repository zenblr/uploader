'use strict';

const electron      = require('electron');
const app           = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain       = require('electron').ipcMain;

var querystring     = require('querystring');

var mainWindow;

var log4js          = require('./log');
var logger          = log4js.getLogger("APP", "DEBUG");

var appdb = null;

require('./db').open(function(db) {
    appdb = db;
    appdb.collection('fiddles').updateOne(
        {
            "name": "csv_upload",
        },
        {
            $set: {
                "name": "csv_upload",
                "html": "csv_upload.html"
            }
        },
        {
            upsert:true
        }
    );
});

var utils           = require('./utils');

const SUCCESS       = "success";
const FAIL          = "fail";


app.on('ready', function() {
    mainWindow = new BrowserWindow({width: 800, height: 600});
    mainWindow.loadURL('file://' + __dirname + '/index.html');
    //mainWindow.webContents.openDevTools();
    mainWindow.on('closed', function() {
        mainWindow = null;
    });
});

app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});


ipcMain.on('synchronous-message', function(event, arg) {
    if (typeof(arg) == "string")
        switch(arg) {
            case 'get_tenants':
                get_tenants(function(tenants) {
                    event.returnValue = tenants;
                });
                break;
            case 'get_fiddles':
                get_fiddles(function(fiddles) {
                    event.returnValue = fiddles;
                });
                break;
            default:
                event.returnValue = null;
                break;
        }
    else
        switch(arg.action) {
            case 'add_tenant':
                var creds = querystring.parse(arg.tenant);
                add_tenant(creds, function(tenants) {
                    event.returnValue = tenants;
                });
                break;
            case 'get_fiddle':
                get_fiddle(arg.name, function(fiddle) {
                    event.returnValue = fiddle;
                });
                break;
            case 'init_tenant':
                init_tenant(arg.params, function(access_token) {
                    event.returnValue = access_token;
                });
                break;
            default:
                event.returnValue = null;
                break;
        }
});

function get_tenants(cb) {
    var tenants = appdb.collection('tenants').find({}, {'creds.domain':true}).toArray(function(err, tenants) {
       if (err) {
           logger.error("[get_tenants] "+JSON.stringify(err));
           cb({status:FAIL, message:err});
       } else {
           var tenants = tenants.map(function(v) {
               return v.creds.domain;
           });
           cb(tenants);
       }
    });
}

function get_fiddles(cb) {
    var fiddles = appdb.collection('fiddles').find({}, {'name':true}).toArray(function(err, fiddles) {
        if (err) {
            logger.error("[get_fiddles] "+JSON.stringify(err));
            cb({status:FAIL, message:err});
        } else {
            var fiddles = fiddles.map(function(v) {
                return v.name;
            });
            cb(fiddles);
        }
    });
}

function add_tenant(creds, cb) {
    appdb.collection('tenants').updateOne(
        {
            "creds.domain":creds.domain
        },
        {$set:{creds:creds}},
        {upsert:true},
        function(err, results) {
            if (!err) {
                get_tenants(cb);
                return;
            }
            cb({status:FAIL, message:err});
        }
    )
}

function get_fiddle(name, cb) {
    appdb.collection('fiddles').findOne({name:name}, function(err, fiddle) {
        if (err) {
            logger.error("[get_fiddle] "+JSON.stringify(err));
            cb({status:FAIL, message:err});
        } else {
            cb(fiddle);
        }
    });
}

function init_tenant(params, cb) {
    appdb.collection('tenants').findOne(
        {
            "creds.domain": params.domain
        },
        {
            "creds": true,
            "clients": {
                $elemMatch: {
                    username: params.username
                }
            }
        },
        function (err, tenant) {
            if (!err && tenant) {
                if (tenant.clients && is_valid_token(tenant.clients[0].token)) {
                    //check if password is okay
                    utils.verifyPassword(params.password, tenant.clients[0].password, function (isCorrect) {
                        if (isCorrect) {
                            cb(tenant.clients[0].token.access_token);
                        }
                        else {
                            cb({status: FAIL, message: "incorrect username/password"});
                        }
                    });
                    return;
                }
                else {
                    refresh_token(tenant.creds, params.username, params.password, function (result) {
                        if (result.status == SUCCESS) {
                            utils.encodePassword(params.password, function (encPassword) {
                                var client = {
                                    token: result.token,
                                    username: params.username,
                                    password: encPassword
                                };
                                if (tenant.clients) {
                                    appdb.collection('tenants').updateOne(
                                        {
                                            "creds.domain": params.domain,
                                            "clients.username": params.username
                                        },
                                        {
                                            $set: {
                                                "clients.$": client
                                            }
                                        }
                                    );
                                } else {
                                    appdb.collection('tenants').updateOne(
                                        {
                                            "creds.domain": params.domain
                                        },
                                        {
                                            $push: {
                                                clients: client
                                            }
                                        }
                                    );
                                }
                                cb(client.token.access_token);
                            });
                        } else {
                            cb({status: FAIL, message: result.message});
                        }
                    });
                }
            }
            else {
                cb({status: FAIL, message: err});
            }
        }
    );
}

function is_valid_token(token) {
    var now = Date.now();
    var then = token.date;
    if (((now-then)/1000) > token.expires_in) {
        return false;
    }
    return true;
}

function refresh_token(creds,username, password, cb) {
    var access_data = {
        grant_type   : creds['grant_type'],
        client_id    : creds['client'],
        client_secret: creds['secret'],
        scope        : creds['scopes'],
        redirect_uri : creds['redirect_uri'],
        username     : username,
        password     : password
    };
    authenticate(creds['domain'], access_data, function(data) {
        if (data.access_token) {
            data.date = Date.now();
            cb({status:SUCCESS, token:data});
            return;
        }
        else {
            cb({status:FAIL, message:JSON.stringify(data)});
        }
    });
}

function authenticate(domain, access_data, cb) {
    var port         = 443;
    var querystring = require('querystring'),
        https       = require('https');

    var data = querystring.stringify(access_data);

    var options = {
        host: domain,
        port: port,
        path: "/rest/auth/token",
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data),
            'Accept': "application/json; charset=utf-8",
            "X-Timeli-Version": "2.0"
        }
    };

    var repl = '';
    var req = https.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            repl += chunk;
        });
        res.on('end', function () {
            cb(JSON.parse(repl));
        });
        res.on('error', function (e) {
            logger.error(e);
            cb(e);
        });
    });

    req.on('error', function(err) {
        logger.error(err);
        cb(err);
    });

    req.write(data);
    req.end();
}
