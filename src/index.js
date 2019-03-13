
var {
  WebSocketBackend,
  WebSocketFrontend,
} = require("./socket");

var {
  WebSocketScenario,
} = require("./scenario");

var expose = global;
if (typeof window !== 'undefined')
  expose = window;
else if (typeof global !== 'undefined')
  expose = global;
else
  expose = {};

expose.WebSocketOriginal = expose.WebSocket;
expose.WebSocket = WebSocketFrontend;

module.exports = {
  WebSocketBackend,
  WebSocketFrontend,
  WebSocketScenario,
};
