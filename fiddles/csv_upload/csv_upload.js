/*APP.SDK.init($,{
        domain: "midsbx.timeli.io", //"localhost"
        port: 443,
        client_token: "JPslDFZ_IUe9QIwCNNf4K4XH2OiOFyGiZbAkxS75Kj2VDxnmv5qQMMzJWGzi13V3zMX2jV89IYTxoGeQPltlETFzrRFlrsl1ZZyMoHc6e9c",
        https: true
    });*/

(function($, SDK) {
    
    var data = null,
        batchSize = 10000,
        channels = {},
        assets = {},
        parseCSV = function(text) {
            var delimiter = ",",
                pattern = new RegExp(
                    "(\\" + delimiter + "|\\r?\\n|\\r|^)(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^\"\\" + delimiter + "\\r\\n]*))", "gi"
                ),
                quotePattern = new RegExp("\"\"", "g"),
                matches = null,
                result = {},
                headers = [],
                isRowEnd = function(matches) {
                    return matches[1].length && matches[1] != delimiter;
                },
                getValue = function(matches) {
                    if (matches[2]) {
                        return matches[2].replace(quotePattern, "\"");
                    }
                    else if (matches[3]) {
                        return matches[3];
                    }
                },
                row = 0,
                col = 0;
            
            while (matches = pattern.exec(text)) {
                var value = getValue(matches),
                    rowEnd = isRowEnd(matches);
                if (row == 0 && !rowEnd) {
                    result[value] = [];
                    headers.push(value);
                }
                else {
                    if (rowEnd) {
                        row ++;
                        col = 0;
                    }
                    result[headers[col]].push(value);
                    col++;
                }
            }
            return result;
        },
        timestampLabel = "Timestamp Column",
        channelLabel = "Channel Columns",
        template = ("<div class=\"timestamp-candidates\"><h3>{timestamp-label}</h3><ul></ul></div>" + "<div class=\"channel-candidates\"><h3>{channel-label}</h3><ul></ul></div>").replace("{timestamp-label}",timestampLabel).replace("{channel-label}",channelLabel),
        createSelect = function(parent, target, channels) {
            var s = $("<select class=\"channel\">");
            $(channels).each(function(i, item) {
                s.append("<option value=\"" + item.key +"\">" + item.label + "</option>");
            });
            parent.append(s);
            return s;
        },
        getTimestampColumn = function(){
            return data[$(".timestamp-candidates input:checked").val()];
        },
        getChannelColumns = function() {
            var result = [];
            $(".channel-candidates input:checked").each(function(i, item){
                var $item = $(item),
                    parent = $item.parents("li"),
                    val = $item.val(),
                    channel = parent.find("select.channel").val();
                result.push({channel: channel, key: val});
            });
            return result;
        },
        getAssetId = function() {
            return $("select.asset").val();
        },
        getAsset = function() {
            return assets[getAssetId()];
        },
        mapHeaders = function(data, channels) {
            var ctr = $(".container");
            ctr.html("");
            ctr.append(template);
            
            var tsCandidates = ctr.find(".timestamp-candidates"),
                chCandidates = ctr.find(".channel-candidates"),
                cnt = 0;
            for (var h in data) {
                tsCandidates.append("<li><label><input type=\"radio\" class=\"timestamp candidate-" + cnt +"\" name=\"timestamp\" value=\"" + h + "\"/>" + h + "</label></li>");
                chCandidates.append("<li><label><input type=\"checkbox\" class=\"channel candidate-" + cnt +"\" name=\"channels\" value=\"" + h + "\"/>" + h + "</label></li>");
                cnt ++;
            }
            ctr.on("click", ".timestamp-candidates input.timestamp", function() {
                var v = $(this).val();
                $(".channel-candidates").find("input.channel").each(function(i, item) {
                    var inp = $(item),
                        li = inp.parents("li");
                    inp.val() == v ? li.hide() : li.show();
                });
            });
            ctr.on("click", ".channel-candidates input.channel", function() {
                var items = $(".channel-candidates").find("input.channel");
                console.log(getAssetId());
                items.each(function(i, item) {
                    var $item = $(item),
                        li = $item.parents("li"),
                        s = li.find("select.channel");
                    if (!s.length) {
                        s = createSelect(li, $item.val(), channels);
                    }
                    item.checked ? s.show() : s.hide();
                    
                });
            });
            $(".csv-upload").click(function(){
                var ts = getTimestampColumn(),
                    channels = getChannelColumns(),
                    calls = [];
                $(channels).each(function(i, channel) {
                    var pointer = 0,
                        values = data[channel.key];
                    
                    while (pointer < ts.length) {
                        calls.push(getUpload(ts, values, pointer, channel, function(newPointer){
                            pointer = newPointer;
                        }));
                    }
                });
                cascade(calls);
            });
        },
        cascade = function(functionList) {
            if (functionList.length) {
                var f = functionList[0],
                    remaining = functionList.slice(1);
                f.call(this, function() {
                    cascade(remaining);
                });
            }
        },
        getUpload = function(ts, values, pointer, channel, done) {
            var postData = [],
                added = Math.min(batchSize, ts.length - pointer),
                testOnly = $(".test-csv-only").prop("checked");
            for (var j = pointer; j < pointer + added; j++) {
                postData.push({timestamp: ts[j], value: values[j]});
            }
            pointer += added;

            done && done(pointer);
            return function(cb) {
                console.log("posting", postData.length, "values to", channel.channel,"on", getAsset(), "starting at", postData[0].timestamp,"ending at",postData[postData.length-1].timestamp);
                if (!testOnly) {
                    SDK.Measurement.add(SDK.MeasurementType.interval, getAssetId(), postData, channel.channel, function(error, result) {
                            console.log("server response", error, result);
                            cb.call(this);
                        });
                }
                else {
                      cb.call(this);
                }
              };
        },
        loadChannels = function(assetId, cb) {
            var callback = function(error, channels) {
                SDK.HTML.buildSelect(channels, {
                                        select: $("select.channel")
                                    }, "label", "key");
                cb && cb.call(this, error, channels);
            };
            if (channels[assetId]) {
                callback(null, channels[assetId]);
            }
            else {
                SDK.Asset.Channel.get(assetId, callback);
            }
        };
    
    $(".csv-import").change(function(e) {
        if (e.target.files != undefined) {
            var reader = new FileReader();
            reader.addEventListener("load", function(e) {
                data = parseCSV(e.target.result);
                SDK.Asset.Channel.get(getAssetId(), function(error, channels){
                    mapHeaders(data, channels);
                });
            });
            reader.readAsText(e.target.files.item(0));
        }
    });

    SDK.Asset.get(function(error, vals){
        assets = {};
        var s = $("select.asset");
        s.html("");
        $(vals).each(function(i, asset) {
            assets[asset.id] = asset;
            s.append("<option value=\"" + asset.id + "\">" + asset.name + "</option>");
        });
      //  s.change(function() {
     //       loadChannels(s.val());
     //   });
     //   loadChannels(s.val(), function() {//
            $("div.controls").removeClass("hidden");
     //   });
    });
    
})($, parent.APP.SDK);
