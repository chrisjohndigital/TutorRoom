var express = require('express');
var server = require('http').Server(express);
var router = express.Router();
var io = require('socket.io')(server);

var app_clients = [];
var app_clients_nbr = 0;

server.listen(8080);

io.on('connection', function (socket) {
    console.log ('Connection attempt: ' + socket.id);
    app_clients [app_clients.length] = {socket: socket, id: (String(socket.id)), token: null, description: null}
    var index = app_clients.length-1;
    var id = socket.id;
    ++app_clients_nbr;
    console.log ('Connection: total nbr connected clients: ' + app_clients_nbr);
    socket.on('setToken', function (data) {
        app_clients [index].token = data;
        sendHandshake (index, 'Server: emit token-received', 'token-received', data);
        sendGroupMessage (data, 'Server: emit token-users', 'token-users', id, null)
    });
    socket.on('offer', function (data) {
        console.log ('offer: ' + data);
        app_clients [index].description = data;
        sendGroupMessage (app_clients [index].token, 'Server: emit offer', 'offer', id, data)
    });
    socket.on('ice', function (data) {
        console.log ('ice: ' + data);
        sendGroupMessage (app_clients [index].token, 'Server: emit ice', 'ice', id, data)
    });
    socket.on('fileshare', function (data) {
        sendGroupMessage (app_clients [index].token, 'Server: emit fileshare parts', 'fileshare', '', data);
    });
    socket.on('fileshare-complete', function (data) {
        sendGroupMessage (app_clients [index].token, 'Server: emit fileshare completed', 'fileshare-complete', '', data);
    });
    socket.on('disconnect', function () {
        console.log ('disconnect: ' + id);
        delete app_clients[index]
        --app_clients_nbr;
        console.log ('Disconnection: total nbr connected clients: ' + app_clients_nbr);
    });
    sendHandshake (index, 'Server: emit handshake', 'handshake', null);
});
function sendHandshake(index, lbl, type, data) {
    console.log ('sendHandshake: ' + lbl);
    if (app_clients[index]!=undefined) {
        var s = app_clients[index].socket;
        s.emit(type, data); 
    }
}
function sendGroupMessage(token, lbl, type, exclude, data) {
    for (var i = 0; i < app_clients.length; i++) {
        if (app_clients[i]!=undefined && app_clients[i].token==token && app_clients[i].id!=exclude) {
            console.log ('sendTokenMessage: ' + lbl);
            var s = app_clients[i].socket;
            s.emit(type, data); 
        }
     }
}
/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'TutorRoom' });
});

module.exports = router;