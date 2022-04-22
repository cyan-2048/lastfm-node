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

module.exports = LastFmBase;
