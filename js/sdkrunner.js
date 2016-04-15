/**
 * SDK Runner Javascript.
 */

const ipcRenderer = require('electron').ipcRenderer;

$(document).ready(function() {

    refresh_tenants();
    refresh_fiddles();

    $('a.add-tenant').click(function(e) {
        e.preventDefault();
        var ele = $('div.add-tenant').clone();
        var id = ele.find('form#add-tenant').attr('id');
        id = id+'-1';
        ele.find('form#add-tenant').attr('id', id);
        ele.find('button.add-tenant-submit').click(function(e) {
            e.preventDefault();
            hidePopup();
            add_tenant($('#'+id).serialize());

        });
        showPopup(ele, {height:450, closebox:0});
    });



    $('.run-button').click(function(e) {
        e.preventDefault();
        if (($('.select-fiddle').val() == '0') ||
            ($('.select-tenant').val() == '0')) {
            logMsg("ERROR", "Please select fiddle and tenant before running.");
            return;
        }
        var fiddle = 'csv_upload';
        var domain = $('.select-tenant').val();
        var ele = $('div.run-tenant').clone();
        var id = ele.find('form#run-tenant').attr('id');
        id = id+'-1';
        ele.find('form#run-tenant').attr('id', id);
        ele.find('button.run-tenant-submit').click(function(e) {
            e.preventDefault();
            var username = $('form#'+id+' input[name=username]').val();
            var password = $('form#'+id+' input[name=password]').val();
            hidePopup();
            initFiddle({fiddle:fiddle, domain:domain, username:username, password:password});
        });
        showPopup(ele, {height:300, closebox:0});
    });

    $('.clear-transcript').click(function() {
        $('#log').empty().append('<p align="left"></p>');
    });


});


function refresh_tenants() {
    var result = ipcRenderer.sendSync('synchronous-message', 'get_tenants');
    if ((typeof(result) == "object") && ("status" in result)) {
        logMsg("ERROR", result.message);
        return;
    }
    var tenants = result;
    refresh_tenants_ui(tenants);
}

function refresh_fiddles() {

    var result = ipcRenderer.sendSync('synchronous-message', 'get_fiddles');
    if ((typeof(result) == "object") && ("status" in result)) {
        logMsg("ERROR", result.message);
        return;
    }
    var fiddles = result;
    $('.select-fiddle').empty();
    $('.select-fiddle').append($('<option>', {value: "0",text: "Select Fiddle" }));
    fiddles.forEach(function(v) {
        $('.select-fiddle').append($('<option>', {value: v,text: v }));
    });
}

function add_tenant(tenant) {
    var result = ipcRenderer.sendSync('synchronous-message', {'tenant':tenant, 'action':'add_tenant'});
    if ((typeof(result) == "object") && ("status" in result)) {
        logMsg("ERROR", result.message);
        return;
    }
    var tenants = result;
    refresh_tenants_ui(tenants);
}

function refresh_tenants_ui(tenants) {
    $('.select-tenant').empty();
    $('.select-tenant').append($('<option>', {value: "0", text: "Select Tenant"}));
    tenants.forEach(function (v) {
        $('.select-tenant').append($('<option>', {value: v, text: v}));
    });
}

function get_fiddle(name, cb) {
    var result = ipcRenderer.sendSync('synchronous-message', {'name':name, 'action':'get_fiddle'});
    if ((typeof(result) == "object") && ("status" in result)) {
        logMsg("ERROR", result.message);
        cb(null);
        return;
    }
    var fiddle = result;
    cb(fiddle);
}

function init_tenant(domain, username, password, cb) {
    var params = {domain:domain, username:username, password:password};
    var result = ipcRenderer.sendSync('synchronous-message', {'params':params, 'action':'init_tenant'});
    if ((typeof(result) == "object") && ("status" in result)) {
        logMsg("ERROR", result.message);
        cb(null);
        return;
    }
    var client_token = result;
    cb(client_token);
}

function initFiddle(props) {

    var setup = function(cb) {
        init_tenant(props.domain, props.username, props.password, function(client_token) {
            if (client_token == null) {
                cb(false);
                return;
            } else {
                APP.SDK.init($,{
                    domain: props.domain,
                    port: 443,
                    client_token: client_token,
                    https: true
                }, function() {
                    logMsg("INFO", "sdk initialized successfully");
                    cb(true);
                });
            }
        });
    };

    setup(function(success) {
        if (!success) {
            return;
        }
        get_fiddle(props.fiddle, function(fiddle) {
            if (fiddle == null) {
               return;
            }
            var html = fiddle.html ? "./fiddles/"+fiddle.name+"/"+fiddle.html : null;
            if (html != null) {
                $("div#fiddle-canvas").html('<iframe src="'+html+'"></iframe>');
                $("div#fiddle-canvas").removeClass("hidden");
                logMsg("INFO", "fiddle '"+fiddle.name+"' running in window to the right.");
            }
        });
    });
}
/*
 *
 * console related logging methods
 *
 *
 */

function logConsole(event) {
    var str = event.data + "<br>";
    $("#log p:last-child").html($("#log p:last-child").html()+str);
    scroll();
}

function logMsg(type, str) {
    switch(type.toUpperCase()) {
        case "INFO":
            str = '[INFO] '+str+'<br>';
            break;
        case "RESULT":
            addEmptyLine();
            str = str +'<br>';
            break;
        case "ERROR":
            addEmptyLine();
            str = '<p align="left" style="color:red">'+'[ERROR] '+str+'</p><br>';
            addEmptyLine();
            break;
        case "START":
            addEmptyLine();
            str = '[INFO] '+str;
            break;
        case "CONTINUE":
            break;
        case "END":
            str = str +"<br>";
            break;
        default: break;
    }
    $("#log p:last-child").html($("#log p:last-child").html()+str);
    scroll();
}

function addEmptyLine() {
    $("#log").append('<p align="left"></p>');
}

function scroll(){
    var d = document.getElementById("log");
    d.scrollTop = d.scrollHeight;
}

/*
 *
 * ajax busy cursor
 *
 *
 */


$(document).ajaxStart(function () {
    $('#busy').show();
});

$(document).ajaxStop(function () {
    $('#busy').hide();
});

/*
 *
 * popup related methods
 *
 *
 */


function hidePopup() {
    $.colorbox.close();
}

function showPopup(ele, opt) {
    if (!ele) {
        return;
    }

    ele.find('.xbutton').click(function(e) {
        e.preventDefault();
        $.colorbox.close();
    });

    var width = opt && opt.width ? opt.width : 500;
    var height = opt && opt.height ? opt.height : 200;
    var onClosed = opt && opt.onClosed ? opt.onClosed : function() {};

    var onload = function() {
        $('#cboxClose').remove();
    };

    var nullfn = function() {};

    onload = opt && (opt.closebox == 0) ? onload : nullfn;

    $.colorbox({
        html: ele,
        width: width,
        height: height,
        onLoad: onload,
        onClosed:onClosed
    });
}



window.addEventListener("message", logConsole, false);