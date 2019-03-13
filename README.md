# WebSocket mock

Mock websocket connections/requests using [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).
Intended for server-less WebSocket oriented applications development and testing.

Inspired by [fetch-mock](https://github.com/wheresrhys/fetch-mock) project.

Features:

* mocks WebSocket API imitating server routines
* declarative define WebSocket connections usage/handling scenario
* imperative WebSocket connection operations for asynchronous emission
* multiple simultaneous WebSocket connections support
* flexible connection/request/responses delaying

## Usage example

```js
var websocketMock = require("websocketMock");

var scenario = new websocketMock.WebSocketScenario('ws://expected.connection');
scenario
  .whenConnect().handle(function (socket) {
    socket.send('Aye captain!');
    socket.accept();

    socket
      .whenMessage('exit').respondClose(1001)
      .whenMessage().handle(function (socket, data) {
        socket.send('echo', data);
      });
      .whenDisconnect().handle(function (socket, code, reason) {
        socket.send('Hold it there!');
        socket.close(code);
      })
  });

var sock = new WebSocket('ws://expected.connection');
sock.onopen = function (event) {
  // Open handling ..
}
sock.onclose = function (event) {
  // Close handling ..
}
sock.onmessage = function (event) {
  // Data handling ..
}

sock.send('Hello');
sock.close()
```

## Usage API

```
Mocking APIs:

WebSocketBackend (server):
- onConnect(function callback(socket)));
- onDisconnect(function callback(socket)));

WebSocketChannel (server socket):
- onDisconnect(function callback(code, reason))
- onMessage(function callback(data))
- accept()
- close(code, reason, wasClean)
- error(code, reason)
- send(data)

WebSocketFrontend (client WebSocket)
- onopen
- onclose
- onerror
- onmessage
- close(code, reason)
- send(data)
```

## Testing API

```
Testing API:

WebSocketScenario:
- whenConnect() ->
-- handle(function handler(socket));
- whenDisconnect() ->
-- handle(function handler(socket));
- reset()
- connection()
- connectRequests
- disconnectRequests

WebSocketAction:
- whenDisconnect([function matcher()|promise|code,reason])
-- handle(function handler(socket, code, reason))
-- respondClose([function respond(socket, code, reason)|promise|code,reason])
- whenMessage([functio matcher()|promise|data])
-- handle(function handler(socket, data))
-- respondClose([function respond(socket, data)|promise|data])
-- respondData([function respond(socket, data)|promise|data])
- accept()
- close(code, reason, wasClean)
- error(code, reason)
- send(data)
- reset()
- disconnectRequests
- messageRequests
- disconnectRequestsUnexpected
- messageRequestsUnexpected
```

## License

websocket-mock is licensed under the [MIT](https://github.com/edzius/websocket-mock/blob/main/LICENSE) license.
Copyright © 2019, Edvinas Stunžėnas
