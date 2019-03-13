
var {
  WebSocketConnection,
  WebSocketBackend,
} = require("./socket");

const isDefined = (data) => typeof data !== 'undefined';
const isRegexp = (data) => data instanceof RegExp;
const isPromise = (data) => Promise.resolve(data) == data;
const isString = (data) => typeof data === 'string';
const isNumber = (data) => typeof data === 'number';
const isFunction = (data) => typeof data === 'function';
const assertFunction = (data) => {
  if (!isFunction(data))
    throw new Error("WebSocket mock: required function, received", data);
}

class WebSocketActionDisconnectMatcher {
  constructor(...args) {
    this.args = args;

    /* Ensure we will have access to args */
    this.handler.bind(this);
  }

  handler(...args) {
    /* Refer to disconnectCallback matcher invocation for
     * precise call arguments list and arguments types. */
    /* Matcher definition arguments */
    let [mcode] = this.args;
    /* Handler execution arguments */
    let [code] = args;

    if (isFunction(mcode))
      return mcode(code);            /* Validate via function. */
    else if (isDefined(mcode))
      return mcode === code;         /* Validate provided value. */
    else
      return true;                   /* Accept when nothing given. */
  }
}

class WebSocketActionMessageMatcher {
  constructor(...args) {
    this.args = args;

    /* Ensure we will have access to args */
    this.handler.bind(this);
  }

  handler(...args) {
    /* Refer to disconnectCallback matcher invocation for
     * precise call arguments list and arguments types. */
    /* Matcher definition arguments */
    let [mdata] = this.args;
    /* Handler execution arguments */
    let [data] = args;

    if (isFunction(mdata))
      return mdata(data);                 /* Validate via function. */
    else if (isRegexp(mdata))
      return mdata.test(data);            /* Validate against regexp. */
    else if (isDefined(mdata))
      return mdata === data;              /* Validate provided value. */
    else
      return true;                        /* Accept when nothing given. */
  }
}

class WebSocketActionCloseResonse {
  constructor(...args) {
    this.args = args;

    /* Ensure we will have access to args */
    this.handler.bind(this);
  }

  handler(...args) {
    /* Refer to messageCallback and disconnectCallback handler
     * invocation for precise call arguments list and arguments
     * types. */
    /* Response definition arguments */
    let [rdata] = this.args;
    /* Handler execution arguments */
    let [socket] = args;

    let rwrap = rdata;
    if (isFunction(rdata))
      rwrap = rdata.apply(this, args);

    Promise.resolve(rwrap).then((rvalue) => {
      if (rvalue === true || rvalue === false)
        socket.close(rvalue ? 1000 : 1006);
      else if (isNumber(rvalue) && rvalue >= 1000 && rvalue <= 10000)
        socket.close(rvalue);
      else
        throw new Error("Invalid close response:", rvalue);
    });
  }
}

class WebSocketActionDataResponse {
  constructor(...args) {
    this.args = args;

    /* Ensure we will have access to args */
    this.handler.bind(this)
  }

  handler(...args) {
    /* Refer to messageCallback and disconnectCallback handler
     * invocation for precise call arguments list and arguments
     * types. */
    /* Response definition arguments */
    let [rdata] = this.args;
    /* Handler execution arguments */
    let [socket] = args;

    let rwrap = rdata;
    if (isFunction(rdata))
      rwrap = rdata.apply(this, args);

    /* Handling functions first gives use possibility
     * to process return values as response values;
     * also in promise case we can even cance send. */
    Promise.resolve(rwrap).then((rvalue) => {
      socket.send(rvalue);
    });
  }
}

/* API compatibility for trusted function handlers. */
class WebSocketActionWrappedResponse {
  constructor(callback) {
    this.callback = callback

    this.handler.bind(this);
  }

  handler(...args) {
    this.callback.apply(this, args);
  }
}

class WebSocketAction extends WebSocketConnection {
  constructor(backend, frontend) {
    super(backend, frontend);

    this.disconnectRequestHandlers = [];
    this.messageRequestHandlers = [];

    this.reset();
  }

  reset() {
    this.disconnectRequests = [];
    this.messageRequests = [];
    this.disconnectRequestsUnexpected = [];
    this.messageRequestsUnexpected = [];
  }

  whenDisconnect(...margs) {
    return {
      handle: (callback) => {
        assertFunction(callback);

        this.disconnectRequestHandlers.push({
          matcher: new WebSocketActionDisconnectMatcher(...margs),
          respond: new WebSocketActionWrappedResponse(callback),
        });
        return this;
      },
      respondClose: (...rargs) => {
        this.disconnectRequestHandlers.push({
          matcher: new WebSocketActionDisconnectMatcher(...margs),
          respond: new WebSocketActionCloseResonse(...rargs),
        });
        return this;
      }
    }
  }

  whenMessage(...margs) {
    return {
      handle: (callback) => {
        assertFunction(callback);

        this.messageRequestHandlers.push({
          matcher: new WebSocketActionMessageMatcher(...margs),
          respond: new WebSocketActionWrappedResponse(callback),
        });
        return this;
      },
      respondClose: (...rargs) => {
        this.messageRequestHandlers.push({
          matcher: new WebSocketActionMessageMatcher(...margs),
          respond: new WebSocketActionCloseResonse(...rargs),
        });
        return this;
      },
      respondData: (...rargs) => {
        this.messageRequestHandlers.push({
          matcher: new WebSocketActionMessageMatcher(...margs),
          respond: new WebSocketActionDataResponse(...rargs),
        });
        return this;
      }
    }
  }

  disconnectCallback(code, reason) {
    if (_TEST)
      this.disconnectRequests.push({
        socket: this,
        code: code,
        reason: reason,
      });

    /* Default disconnect callback. */
    if (this.disconnectRequestHandlers.length === 0) {
      if (_TEST) {
        this.disconnectRequestsUnexpected.push({
          socket: this,
          code: code,
          reason: reason,
        });
      } else {
        console.warn("WebSocket mock: no disconnect actions registered. Default close echo", `(${code} ${reason})`);
        this.close(code, reason);
        return;
      }
    }

    let actions = this.disconnectRequestHandlers.filter((handler) => {
      return handler.matcher.handler(code, reason);
    });

    if (actions.length > 1) {
      console.warn("WebSocket mock: multiple disconnect actions matches", `(${code} ${reason})`);
    } else if (actions.length === 0) {
      if (_TEST)
        this.disconnectRequestsUnexpected.push({
          socket: this,
          code: code,
          reason: reason,
        });
      else
        throw new Error("WebSocket mock: no disconnect actions matches", `(${code} ${reason})`);
    }

    //invoke(actions[0].respond.handler, this.backend, this, code, reason);
    actions[0].respond.handler(this, code, reason);
  }

  messageCallback(data) {
    if (_TEST)
      this.messageRequests.push({
        socket: this,
        data: data,
      });

    let actions = this.messageRequestHandlers.filter((handler) => {
      return handler.matcher.handler(data);
    });

    if (actions.length > 1) {
      console.warn("WebSocket mock: more than one message actions found", `(${data})`);
    } else if (actions.length === 0) {
      if (_TEST)
        this.messageRequestsUnexpected.push({
          socket: this,
          data: data,
        });
      else
        throw new Error("WebSocket mock: no message actions matches", `(${data})`);
    }

    //invoke(actions[0].respond.handler, this.backend, this, data);
    actions[0].respond.handler(this, data);
  }
}

class WebSocketScenario extends WebSocketBackend {
  constructor(url, protocols) {
    super(url, protocols);

    /* TODO: maybe implement matchers here too? */
    this.connectRequestHandler = null;
    this.disconnectRequestHandler = null;

    this.reset();
  }

  connection(id) {
    id = +id;
    if (!id)
      id = 0;
    return this.connections[id];
  }

  reset() {
    this.connectRequests = [];
    this.disconnectRequests = [];
  }

  doConnect(client) {
    return this._doConnect(new WebSocketAction(this, client));
  }

  whenConnect() {
    return {
      handle: (handler) => {
        this.connectRequestHandler = handler;
        return this;
      }
    }
  }

  whenDisconnect() {
    return {
      handle: (handler) => {
        this.disconnectRequestHandler = handler;
        return this;
      }
    }
  }

  connectCallback(socket) {
    if (_TEST)
      this.connectRequests.push({
        socket,
        url: socket.url,
        protocol: socket.protocol
      });

    if (!this.connectRequestHandler) {
      socket.close(); /* Wuh, no handler!? What's being mocked? */
      return;
    }

    //invoke(this.connectRequestHandler, this, socket);
    this.connectRequestHandler(socket);
  }

  disconnectCallback(socket) {
    if (_TEST)
      this.disconnectRequests.push({
        socket,
        url: socket.url,
        protocol: socket.protocol
      });

    if (!this.disconnectRequestHandler) {
      return;
    }

    //invoke(this.disconnectRequestHandler, this, socket);
    this.disconnectRequestHandler(socket);
  }
}

var expose = global;
if (typeof window !== 'undefined')
  expose = window;
else if (typeof global !== 'undefined')
  expose = global;
else
  expose = {};

if (!Object.prototype.hasOwnProperty.call(expose, '_TEST'))
  expose._TEST = null;

module.exports = {
  WebSocketScenario,
};
