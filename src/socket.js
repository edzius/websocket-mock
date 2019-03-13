
const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

var mocks = [];

function registerBackend(wsbe, url, protocols) {
  mocks.push({
    url: url,
    protocols: protocols,
    backend: wsbe,
  });
}

function selsectBackend(wsfe, url, protocols) {
  /* TODO(edzius): warn when more than
   * one suitable mocks are found. */
  let result = mocks.filter((mock) => {
    if (mock.url !== url)
      return false;

    return mock.protocols.some((protocol) => {
      if (Array.isArray(protocols))
        return protocols.includes(protocol);
      else
        return protocols === protocol;
    });
  })[0];

  if (!result)
    return null;
  else
    return {
      url: result.url,
      protocol: result.protocols[0],
      backend: result.backend,
    };
}

function invoke(fn, self, ...args) {
  if (typeof fn !== 'function')
    return;
  return fn.apply(self, args);
}

function localUrl() {
  let address = 'localhost';
  let protocol = 'ws:';
  if (typeof window !== 'undefined') {
    address = window.location.host;
    protocol = window.location.protocol.replace('http', 'ws');
  }
  return protocol + '//' + address;
}

function resolveUrl(uri) {
  if (!uri.startsWith('/'))
    return uri;

  return localUrl() + uri;
}

class WebSocketConnection {
  constructor(backend, frontend) {
    this.backend = backend;
    this.frontend = frontend;

    /* Overrides inherited object functions; no need to initialize. */
    //this.disconnectCallback = null;
    //this.messageCallback = null;
  }

  /* Internal API */
  doDisconnect(code, reason) {
    invoke(this.disconnectCallback, this, code, reason);
    /* Propagate event to backend (server). */
    this.backend.doDisconnect(this.frontend);
  }

  doMessage(data) {
    invoke(this.messageCallback, this, data);
  }

  /* User API */
  onDisconnect(callback) {
    this.disconnectCallback = callback;
    return this;
  }

  onMessage(callback) {
    this.messageCallback = callback;
    return this;
  }

  accept() {
    /* Open event simulation. */
    let event = {};
    this.frontend.doOpen(event);
  }

  close(code, reason, wasClean) {
    /* Close event simulation. */
    let event = {
      code: code || 1006,
      reason: reason,
      wasClean: wasClean || !!code
    };
    if (!event.wasClean)
      this.error(event.code, event.reason);
    this.frontend.doClose(event);
  }

  error(code, reason) {
    /* Error event simulation. */
    let event = {
      code: code || 1006,
      reason: reason
    };
    this.frontend.doError(event);
  }

  send(data) {
    /* Message event simulation. */
    let event = {
      data: data,
      origin: '',
      lastEventId: '',
      source: '',
      ports: []
    };
    this.frontend.doMessage(event);
  }
}

class WebSocketBackend {
  constructor(url, protocols) {
    if (!url)
      url = localUrl();
    else
      url = resolveUrl(url);

    this.url = url;
    this.protocols = protocols || [''];

    registerBackend(this, this.url, this.protocols);

    this.connections = [];
    /* Overrides inherited object functions; no need to initialize. */
    //this.connectCallback = null;
    //this.disconnectCallback = null;
  }

  /* Internal API */
  _doConnect(connection) {
    this.connections.push(connection);
    invoke(this.connectCallback, this, connection);
    return connection;
  }

  doConnect(client) {
    return this._doConnect(new WebSocketConnection(this, client));
  }

  doDisconnect(client) {
    /* XXX: this is kind'a muffler way to find connection,
     * since called is connection itself, however this is
     * correct way to do that. */
    let connection = this.connections.filter((connection) => {
      return connection.frontend === client;
    })[0];
    if (!connection)
      throw new Error('Connection already gone for: ', client.url);

    let index = this.connections.indexOf(client);
    if (index !== -1)
      this.connections.splice(index, 1);

    invoke(this.disconnectCallback, this, connection);
  }

  /* User API */
  onConnect(callback) {
    this.connectCallback = callback;
    return this;
  }

  onDisconnect(callback) {
    this.disconnectCallback = callback;
    return this;
  }
}

class WebSocketFrontend {
  constructor(url, protocols) {
    this.url = url;
    this.protocol = '';
    this.readyState = CONNECTING;
    this.binaryType = false;
    this.bufferedAmount = 0;
    this.extensions = '';
    this.onopen = undefined;
    this.onclose = undefined;
    this.onerror = undefined;
    this.onmessage = undefined;

    let result = selsectBackend(this, url, protocols || '');
    if (!result) {
      throw new Error(`No appropriate backend for '${this.url}' (protocols: '${protocols || ''}') found.`)
    }
    this.url = result.url;
    this.protocol = result.protocol;
    this.backend = result.backend;
    this.connection = this.backend.doConnect(this);
  }

  /* Internal API */
  doOpen(event) {
    this.readyState = OPEN;
    invoke(this.onopen, this, event);
  }

  doClose(event) {
    this.readyState = CLOSED;
    invoke(this.onclose, this, event);
  }

  doError(event) {
    invoke(this.onerror, this, event);
  }

  doMessage(event) {
    invoke(this.onmessage, this, event);
  }

  /* User API */
  close(code, reason) {
    if (!this.connection)
      throw new Error(`Not yet connected to '${this.url}'`)
    if (this.readyState === CLOSED)
      return;
    this.readyState = CLOSING;
    this.connection.doDisconnect(code || 1005, reason);
  }

  send(data) {
    if (!this.connection)
      throw new Error(`Not yet connected to '${this.url}'`)
    if (this.readyState !== OPEN)
      return;
    this.connection.doMessage(data);
  }
}
WebSocketFrontend.CONNECTING = CONNECTING;
WebSocketFrontend.OPEN = OPEN;
WebSocketFrontend.CLOSING = CLOSING;
WebSocketFrontend.CLOSED = CLOSED;

module.exports = {
  WebSocketConnection,
  WebSocketBackend,
  WebSocketFrontend,
};
