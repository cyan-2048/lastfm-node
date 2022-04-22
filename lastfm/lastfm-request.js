var //http = require("http"),
	//	querystring = require("querystring"),
	md5 = require("js-md5"),
	LastFmBase = require("./lastfm-base");

class LastFmRequest extends LastFmBase {
	constructor(lastfm, method, params) {
		super();
		var WRITE_METHODS = [
				//		"album.addtags",
				//		"album.removetag",
				//		"album.share",
				//		"artist.addtags",
				//		"artist.removetag",
				//		"artist.share",
				//		"artist.shout",
				//		"event.attend",
				//		"event.share",
				//		"event.shout",
				//		"library.addalbum",
				//		"library.addartist",
				//		"library.addtrack",
				//		"library.removealbum",
				//		"library.removeartist",
				//		"library.removetrack",
				//		"library.removescrobble",
				//		"playlist.addtrack",
				//		"playlist.create",
				//		"radio.tune",
				//		"track.addtags",
				//		"track.ban",
				//		"track.love",
				//		"track.removetag",
				"track.scrobble",
				//		"track.share",
				//		"track.unban",
				//		"track.unlove",
				"track.updatenowplaying",
				//		"user.shout",
			],
			SIGNED_METHODS = [
				"auth.getmobilesession",
				"auth.getsession",
				"auth.gettoken",
				"radio.getplaylist",
				"user.getrecentstations",
				"user.getrecommendedartists",
				"user.getrecommendedevents",
			];
		var that = this;
		params = params || {};

		that.registerHandlers(params.handlers);

		sendRequest(lastfm.host, lastfm.url, params);

		function sendRequest(host, url, params) {
			var httpVerb = isWriteRequest() ? "POST" : "GET";
			var requestParams = buildRequestParams(params);
			function query(obj) {
				var str = [];
				for (var p in obj)
					if (obj.hasOwnProperty(p)) {
						str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
					}
				return str.join("&");
			}
			var data = query(requestParams);
			if (httpVerb == "GET") {
				url += "?" + data;
			}
			var options = {
				//	host: host,
				//	path: url,
				method: httpVerb,
				headers: requestHeaders(httpVerb, host, data),
				body: httpVerb == "POST" ? data : null,
			};
			fetch(host + url, options)
				.then((r) => r.json())
				.then((r) => that.emit("success", r))
				.catch((e) => that.emit("error", e));
			// var req = http.request(options, chunkedResponse);
			// req.on("error", function (error) {
			// 	that.emit("error", error);
			// });
			// if (httpVerb == "POST") {
			// 	req.write(data);
			// }
			// req.end();
			/*
		function chunkedResponse(response) {
			var data = "";
			response.on("data", function (chunk) {
				data += chunk.toString("utf8");
			});
			response.on("end", function () {
				if (lastfm.format !== "json") {
					that.emit("success", data);
					return;
				}
				try {
					var json = JSON.parse(data);
					if (json.error) {
						that.emit("error", json);
						return;
					}
					that.emit("success", json);
				} catch (e) {
					that.emit("error", e);
				}
			});
		}
		*/
		}

		function buildRequestParams(params) {
			var requestParams = that.filterParameters(params, ["signed", "write"]);
			requestParams.method = method;
			requestParams.api_key = requestParams.api_key || lastfm.api_key;
			requestParams.format = requestParams.format || lastfm.format;
			//if (params.track && typeof params.track === "object") {
			//	requestParams.artist = params.track.artist["#text"];
			//	requestParams.track = params.track.name;
			//	if (params.track.mbid) {
			//		requestParams.mbid = params.track.mbid;
			//	}
			//	if (params.track.album) {
			//		requestParams.album = requestParams.album || params.track.album["#text"];
			//	}
			//}
			if (requiresSignature()) {
				requestParams.api_sig = createSignature(requestParams, lastfm.secret);
			}
			return requestParams;
		}

		function requiresSignature() {
			return params.signed || isWriteRequest() || isSignedMethod(method);
		}

		function isWriteRequest() {
			return params.write || isWriteMethod(method);
		}

		function isSignedMethod(method) {
			return method && SIGNED_METHODS.includes(method.toLowerCase());
		}

		function isWriteMethod(method) {
			return method && WRITE_METHODS.includes(method.toLowerCase());
		}

		function requestHeaders(httpVerb, host, data) {
			var headers = {};
			if (httpVerb == "POST") {
				headers["Content-Length"] = data.length;
				headers["Content-Type"] = "application/x-www-form-urlencoded";
			}
			return headers;
		}

		function createSignature(params, secret) {
			var sig = "";
			Object.keys(params)
				.sort()
				.forEach(function (key) {
					if (key != "format") {
						var value = typeof params[key] !== "undefined" && params[key] !== null ? params[key] : "";
						sig += key + value;
					}
				});
			sig += secret;
			return md5.hex(sig);
		}
	}
}

module.exports = LastFmRequest;