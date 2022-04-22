(function (global) {
	class EventEmitter {
		constructor() {
			this._eventHandlers = {};
		}
		isValidType(type) {
			return typeof type === "string";
		}
		isValidHandler(handler) {
			return typeof handler === "function";
		}
		on(type, handler) {
			if (!type || !handler) return false;
			if (!this.isValidType(type)) return false;
			if (!this.isValidHandler(handler)) return false;
			let handlers = this._eventHandlers[type];
			if (!handlers) handlers = this._eventHandlers[type] = [];
			if (handlers.indexOf(handler) >= 0) return false;
			handler._once = false;
			handlers.push(handler);
			return true;
		}
		once(type, handler) {
			if (!type || !handler) return false;
			if (!this.isValidType(type)) return false;
			if (!this.isValidHandler(handler)) return false;
			const ret = this.on(type, handler);
			if (ret) {
				handler._once = true;
			}
			return ret;
		}
		off(type, handler) {
			if (!type) return this.offAll();
			if (!handler) {
				this._eventHandlers[type] = [];
				return;
			}
			if (!this.isValidType(type)) return;
			if (!this.isValidHandler(handler)) return;
			const handlers = this._eventHandlers[type];
			if (!handlers || !handlers.length) return;
			for (let i = 0; i < handlers.length; i++) {
				const fn = handlers[i];
				if (fn === handler) {
					handlers.splice(i, 1);
					break;
				}
			}
		}
		offAll() {
			this._eventHandlers = {};
		}
		emit(type, data) {
			if (!type || !this.isValidType(type)) return;
			const handlers = this._eventHandlers[type];
			if (!handlers || !handlers.length) return;
			const event = this.createEvent(type, data);
			for (const handler of handlers) {
				if (!this.isValidHandler(handler)) continue;
				if (handler._once) event.once = true;
				handler(event);
				if (event.once) this.off(type, handler);
			}
		}
		has(type, handler) {
			if (!type || !this.isValidType(type)) return false;
			const handlers = this._eventHandlers[type];
			if (!handlers || !handlers.length) return false;
			if (!handler || !this.isValidHandler(handler)) return true;
			return handlers.indexOf(handler) >= 0;
		}
		getHandlers(type) {
			if (!type || !this.isValidType(type)) return [];
			return this._eventHandlers[type] || [];
		}
		createEvent(type, data, once = false) {
			const event = { type, data, timestamp: Date.now(), once };
			return event;
		}
	}

	function each(obj, func) {
		return Object.keys(obj).forEach((a) => {
			func(obj[a], a);
		});
	}

	class LastFmBase extends EventEmitter {
		constructor() {
			super();
		}
		registerHandlers(handlers) {
			if (typeof handlers !== "object") {
				return;
			}
			var that = this;
			each(handlers, function (value, key) {
				that.on(key, value);
			});
		}
		filterParameters(parameters, blacklist) {
			var filteredParams = {};
			each(parameters, function (value, key) {
				if (isBlackListed(key)) {
					return;
				}
				filteredParams[key] = value;
			});
			return filteredParams;

			function isBlackListed(name) {
				return ["error", "success", "handlers"].includes(name) || (blacklist || []).includes(name);
			}
		}
		scheduleCallback(callback, delay) {
			return setTimeout(callback, delay);
		}

		cancelCallback(identifier) {
			clearTimeout(identifier);
		}
	}

	class LastFmUpdate extends LastFmBase {
		constructor(lastfm, method, session, options) {
			var retryOnErrors = [
					11, // Service offline
					16, // Temporarily unavailable
					29, // Rate limit exceeded
				],
				retrySchedule = [
					10 * 1000, // 10 seconds
					30 * 1000, // 30 seconds
					60 * 1000, // 1 minute
					5 * 60 * 1000, // 5 minutes
					15 * 60 * 1000, // 15 minutes
					30 * 60 * 1000, // 30 minutes
				];

			var that = this;
			options = options || {};
			super();

			registerEventHandlers(options);

			if (!session.isAuthorised()) {
				this.emit("error", {
					error: 4,
					message: "Authentication failed",
				});
				return;
			}
			if (method !== "scrobble" && method !== "nowplaying") {
				return;
			}
			update(method, options);

			function registerEventHandlers(options) {
				that.registerHandlers(options.handlers);
			}

			function update(method, options) {
				if (method == "scrobble" && !options.timestamp) {
					that.emit("error", {
						error: 6,
						message: "Invalid parameters - Timestamp is required for scrobbling",
					});
					return;
				}

				var retryCount = 0,
					params = buildRequestParams(options),
					requestMethod = method == "scrobble" ? "track.scrobble" : "track.updateNowPlaying";
				makeRequest();

				function makeRequest() {
					var request = lastfm.request(requestMethod, params);
					request.on("error", errorCallback);
					request.on("success", successCallback);
				}

				function successCallback(response) {
					if (response) {
						that.emit("success", options.track);
					}
				}

				function errorCallback(error) {
					if (shouldBeRetried(error)) {
						var delay = delayFor(retryCount++),
							retry = {
								error: error.error,
								message: error.message,
								delay: delay,
							};
						that.emit("retrying", retry);
						that.scheduleCallback(makeRequest, delay);
						return;
					}
					bubbleError(error);
				}

				function shouldBeRetried(error) {
					return method == "scrobble" && retryOnErrors.includes(error.error);
				}
			}

			function bubbleError(error) {
				that.emit("error", error);
			}

			function buildRequestParams(params) {
				var requestParams = that.filterParameters(params);
				requestParams.sk = session.key;
				return requestParams;
			}

			function delayFor(retryCount) {
				var index = Math.min(retryCount, retrySchedule.length - 1);
				return retrySchedule[index];
			}
		}
	}

	class LastFmSession extends LastFmBase {
		constructor(lastfm, options, key) {
			options = options || {};
			var that = this,
				retry = true;
			super();

			if (typeof options !== "object") {
				this.user = options || "";
				this.key = key || "";
			} else {
				this.user = options.user || "";
				this.key = options.key || "";
			}

			if (options.token) {
				authorise(options.token, options);
			}

			/**
			 * @deprecated
			 */
			this.authorise = function (token, options) {
				authorise(token, options);
			};

			this.cancel = function () {
				retry = false;
			};

			function authorise(token, options) {
				options = options || {};

				registerEventHandlers(options);

				validateToken(token, options);
			}

			function registerEventHandlers(options) {
				that.registerHandlers(options.handlers);
			}

			function validateToken(token, options) {
				options = options || {};
				if (!token) {
					that.emit("error", new Error("No token supplied"));
					return;
				}

				var params = { token: token },
					request = lastfm.request("auth.getsession", params);

				request.on("success", authoriseSession);

				request.on("error", function handleError(error) {
					if (shouldBeRetried(error)) {
						if (!retry) {
							return;
						}
						var delay = options.retryInterval || 10000;
						that.emit("retrying", {
							error: error.error,
							message: error.message,
							delay: delay,
						});
						that.scheduleCallback(function () {
							validateToken(token, options);
						}, delay);
						return;
					}
					bubbleError(error);
				});
			}

			function shouldBeRetried(error) {
				return error.error == 14 || error.error == 16 || error.error == 11;
			}

			function authoriseSession(result) {
				if (!result.session) {
					that.emit("error", new Error("Unexpected error"));
					return;
				}
				setSessionDetails(result.session);
				that.emit("authorised", that);
				that.emit("success", that);
			}

			function setSessionDetails(session) {
				that.user = session.name;
				that.key = session.key;
			}

			function bubbleError(error) {
				that.emit("error", error);
			}
		}

		isAuthorised() {
			return this.key !== "";
		}
	}

	class LastFmRequest extends LastFmBase {
		constructor(lastfm, method, params) {
			var WRITE_METHODS = ["track.scrobble", "track.updatenowplaying"],
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
			super();
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
					method: httpVerb,
					headers: requestHeaders(httpVerb, host, data),
					body: httpVerb == "POST" ? data : null,
				};
				fetch(host + url, options)
					.then((r) => r.json())
					.then((r) => that.emit("success", r))
					.catch((e) => that.emit("error", e));
			}

			function buildRequestParams(params) {
				var requestParams = that.filterParameters(params, ["signed", "write"]);
				requestParams.method = method;
				requestParams.api_key = requestParams.api_key || lastfm.api_key;
				requestParams.format = requestParams.format || lastfm.format;
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
				return md5(sig);
			}
		}
	}

	class LastFmNode {
		constructor(options) {
			options = options || {};
			this.url = "/2.0/";
			this.host = options.host || "http://ws.audioscrobbler.com";
			this.format = "json";
			this.secret = options.secret;
			this.api_key = options.api_key;
		}
		request(method, params) {
			return new LastFmRequest(this, method, params);
		}

		update(method, session, options) {
			return new LastFmUpdate(this, method, session, options);
		}
		session(user, key) {
			return new LastFmSession(this, user, key);
		}
	}

	global.LastFmNode = LastFmNode;
})(window);
