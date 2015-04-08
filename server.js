// creating global parameters and start
// listening to 'port', we are creating an express
// server and then we are binding it with socket.io
var express 	= require('express'),
	app			= express(),
    server  	= require('http').createServer(app),
    io      	= require('socket.io').listen(server),
    port    	= 8080,

    // hash object to save clients data,
    // { socketid: { clientid, nickname }, socketid: { ... } }
    chatClients = new Object();
   // __dirname = '/home/wusuichao';
//var blackList = new Object();
var nameOfRooms = [];
var createTimeOfRooms = [];
var creatorOfRooms = [];
var passwordOfRooms = [];
var passwordFlagOfRooms = [];
// listening to port...
server.listen(port);

// configure express, since this server is
// also a web server, we need to define the
// paths to the static files
//app.use("/styles", express.static(__dirname + '/public/styles'));
//app.use("/scripts", express.static(__dirname + '/scripts'));
//app.use("/socket.io", express.static(__dirname + '/socket.io'));
//app.use("/images", express.static(__dirname + '/public/images'));

// serving the main applicaion file (index.html)
// when a client makes a request to the app root
// (http://localhost:8080/)
app.get('/', function (req, res) {
	//res.sendFile(__dirname + "/socket.io/socket.io.js");
	res.sendFile(__dirname + '/client.html');
});
app.get('/scripts/delete_dom.js', function (req, res) {
	//res.sendFile(__dirname + "/socket.io/socket.io.js");
	res.sendFile(__dirname + '/scripts/delete_dom.js');
});
app.get('/scripts/chatroom.io.js', function (req, res) {
	//res.sendFile(__dirname + "/socket.io/socket.io.js");
	res.sendFile(__dirname + '/scripts/chatroom.io.js');
});
console.log("scripts have been sent to clients!");

// sets the log level of socket.io, with
// log level 2 we wont see all the heartbits
// of each socket but only the handshakes and
// disconnections
//io.set('log level', 2);

// setting the transports by order, if some client
// is not supporting 'websockets' then the server will
// revert to 'xhr-polling' (like Comet/Long polling).
// for more configurations got to:
// https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
//io.set('transports', [ 'websocket', 'xhr-polling' ]);

// socket.io events, each connection goes through here
// and each event is emited in the client.
// I created a function to handle each event
io.sockets.on('connection', function(socket){
	//socket.emit('connectted');
	// after connection, the client sends us the 
	// nickname through the connect event
	console.log("wait to listen to connect from client....");
	socket.on('connectted', function(data){
		console.log("detect one connect");
		connect(socket, data); // data: {nickname: nickname}
	});

	// when a client sends a messgae, he emits
	// this event, then the server forwards the
	// message to other clients in the same room
	socket.on('chatmessage', function(data){
		chatmessage(socket, data);
	});
	
	socket.on('pvtchatmessage', function(data){
		pvtchatmessage(socket, data);
	});
	
	socket.on('create_room_to_server', function(data){
		if (data.currentSubscribed != null) {
			// unsubscribe the creator from the current room he is in
			unsubscribe(socket, data);
		}
		
		// subscribe the creator to the new room
		subscribe(socket, data);
	});
	socket.on('update_roomlist', function(){
		socket.emit('roomslist', { rooms: nameOfRooms, numClients: countClientsInRooms(nameOfRooms), createTime: createTimeOfRooms, creator: creatorOfRooms, passFlag: passwordFlagOfRooms });
	});
	
	socket.on('subscribe',function(data){
		// check if this client is in the black list of this room
		if(checkBlack(socket, data)){
			// refuse
			socket.emit("joinFail", {message: "You are banned!"});
		}else{
			// accept
			if(data.flag){
				// requrire password check
				if (data.password == passwordOfRooms[data.index]) {
					// password match, subscribe into the room
					subscribe(socket, data);
				}else{
					// password doesn't match
					socket.emit("joinFail", {message: "Password doesn't match!"});
				}
			}else{
				// don't need password check
				subscribe(socket, data);
			}
		}
	});
	
	socket.on('unsubscribe', function(data){
		unsubscribe(socket, data);	
	});
	
	socket.on('pvtmsgreq', function(data){
		var req_friend = data.friend;
		var friendID = getSocketIdByName(req_friend);
		if (!friendID) {
			socket.emit('pvtmsgres', {flag:false, friend:req_friend});
		}else{
			var nickname = data.nickname;
			if (!chatClients[socket.id].friend) {
				socket.emit('pvtmsgres', {flag:true, success:true, friend:req_friend});
				io.to(friendID).emit('pvtmsgreqserver', {from:nickname});
			}
			else{
				socket.emit('pvtmsgres', {flag:true, success:false, friend:req_friend});
			}
		}
		
	});
	
	socket.on('pvtmsgreqconf', function(data){
		var friend = data.friend;
		var friendid = getSocketIdByName(friend);
		var selfid = socket.id;
		var self = chatClients[selfid].nickname;
		if (data.confirm) {
			chatClients[selfid].friend = friendid;
			chatClients[friendid].friend = selfid;
			io.to(friendid).emit('pvtmsgconf', {agree:true, friend:self});
		}
		else{
			io.to(friendid).emit('pvtmsgconf', {agree:false, friend:self});
		}
	});
	
	socket.on('pvtmsgend', function(){
		var selfid = socket.id;
		var friendid = chatClients[selfid].friend;
		io.to(friendid).emit('pvtmsgendserver', {friend:chatClients[selfid].nickname});
		chatClients[friendid].friend = null;
		chatClients[selfid].friend = null;
	});
	
	socket.on('banReq', function(data){
		var clientId = getSocketIdByName(data.clientName);
		var bannedRooms = [];
		bannedRooms = chatClients[clientId].bannedRoom;
		bannedRooms.push(data.bannedRoomName);
	});
});

function checkBlack(socket, data) {
	
	for(var banRoom in chatClients[socket.id].bannedRoom){
		if (banRoom == data.room) {
			// refuse the request
			return true;
		}
	}
	return false;
}
// subscribe a client to a room
function subscribe(socket, data){
	// get a list of all active rooms
	//var rooms = getRooms();
	
	// subscribe the client to the room
	socket.join(data.room);
	
	// check if this room is exist, if not, update all 
	// other clients about this new room
	if(data.flagNewRoom){
		var room_name = data.room;
		room_name.replace('/','');
		nameOfRooms.push(room_name);
		createTimeOfRooms.push(getTime());
		creatorOfRooms.push(data.creator);
		passwordFlagOfRooms.push(data.flag);
		if (data.flag) {
			var roomname = data.room;
			roomname.replace('/','');
			passwordOfRooms.push(data.password);
		}
		var numOfClients = countClientsInRoom(data.room);
		socket.broadcast.emit('addroom', { room: data.room, numClients: numOfClients, creator: data.creator, createTime: createTimeOfRooms.room_name, passFlag: data.flag});
		socket.emit('addroom', { room: data.room, numClients: numOfClients, creator: data.creator, createTime: createTimeOfRooms.room_name, passFlag: data.flag});
	}else{
		data.creator = creatorOfRooms[data.index];
	}

	// send to the client a list of all subscribed clients
	// in this room, upon receive 'roomclients', the client side build the room for displaying the room chat area and
	// a list of members, kick and ban function...
	socket.emit('roomclients', { room: data.room, clients: getClientsInRoom(socket.id, data.room), creator:  data.creator});
	//socket.broadcast.to(data.room).emit('roomclients', { room: data.room, clients: getClientsInRoom(socket.id, data.room), creator:  data.creator});

	// update all other clients about the online
	// presence
	updatePresence(data.room, socket, 'online',  data.creator);
	
	socket.broadcast.emit('updateRoominfo', { room: data.room, numClients: numOfClients, creator: data.creator, createTime: createTimeOfRooms.room_name, passFlag: data.flag});
	//socket.emit('updateRoominfo', { room: data.room, numClients: numOfClients, creator: data.creator, createTime: createTimeOfRooms.room_name, passFlag: data.flag});

}

// get array of clients in a room
var getClientsInRoom = function(socketId, roomName, namespace){
	if (!namespace) namespace = '/';
	var socketIds = io.nsps[namespace].adapter.rooms[roomName];
	if (!socketIds) return null;
	// get array of socket ids in this room
	//var socketIds = sockets.adapter.rooms['/' + room];
	var clients = [];
	var socketsCount = Object.keys(socketIds).length;
	console.log("The number of clients in this room is: %d", socketsCount);
	
	if(socketsCount > 0){
		//socketsCount = socketIds.length;
		// push every client to the result array
		//for(var i = 0, len = socketsCount; i < len; i++){
		for (var socket_id in socketIds){
			// check if the socket is not the requesting
			// socket
			console.log("Get the socket id: %s", socket_id);
			
			if(socket_id != socketId){
				var clientinfo = chatClients[socket_id];
				clients.push(clientinfo);
				//console.log("Get one client: %s", clientinfo);
			}
		}
	}
	
	return clients;
}

// unsubscribe a client from a room, this can be
// occured when a client disconnected from the server
// or he subscribed to another room
function unsubscribe(socket, data){
	// update all other clients about the offline
	// presence
	updatePresence(data.currentSubscribed, socket, 'offline');
	
	// remove the client from socket.io room
	socket.leave(data.currentSubscribed);

	// if this client was the only one in that room
	// we are updating all clients about that the
	// room is destroyed
	if(!countClientsInRoom(data.currentSubscribed)){

		// with 'sockets' we can contact all the
		// clients that connected to the server
		io.sockets.emit('removeroom', { room: data.currentSubscribed });
	}
}


// updating all other clients when a client goes
// online or offline. 
function updatePresence(room, socket, state, creatorOfRoom){
	// socket.io may add a trailing '/' to the
	// room name so we are clearing it
	room = room.replace('/','');

	// by using 'socket.broadcast' we can send/emit
	// a message/event to all other clients except
	// the sender himself
	socket.broadcast.to(room).emit('presence', { client: chatClients[socket.id], state: state, room: room, creator: creatorOfRoom });
}

// receive chat message from a client and
// send it to the relevant room
function chatmessage(socket, data){
	// by using 'socket.broadcast' we can send/emit
	// a message/event to all other clients except
	// the sender himself
	if (data.room == 'lobby') {
		socket.broadcast.emit('displaychatmessage', { client: chatClients[socket.id], message: data.message, room: data.room });
	}else{
		socket.broadcast.to(data.room).emit('displaychatmessage', { client: chatClients[socket.id], message: data.message, room: data.room });		
	
	}	
}

function pvtchatmessage(socket, data){
	// by using 'socket.broadcast' we can send/emit
	// a message/event to all other clients except
	// the sender himself
	var friendid = chatClients[socket.id].friend;
	console.log("self: %s, friend: %s.", chatClients[socket.id].nickname, chatClients[friendid].nickname);
	io.to(friendid).emit('displaypvtmessage', { client: chatClients[socket.id], message: data.message });
	
}

// create a client for the socket
function connect(socket, data){
	console.log("client connected!");
	console.log("client nickname: %s", data.nickname);
	console.log('socket id: %s', socket.id);
	//generate clientId
	data.clientId = generateId(); // data: {nickname: nickname, clientId: .....}

	// save the client to the hash object for
	// quick access, we can save this data on
	// the socket with 'socket.set(key, value)'
	// but the only way to pull it back will be
	// async
	chatClients[socket.id] = data;

	// now the client objtec is ready, update
	// the client
	socket.emit('ready', { clientId: data.clientId });
	
	// auto subscribe the client to the 'lobby'
	//subscribe(socket, { room: 'lobby', numClients: countClientsInRoom('lobby'), creator: 'Server' });
	// in our application, all users are automatically subscribed to the lobby room and lobby room are displayed all the time.
	
	// sends a list of all active rooms in the
	// server
	socket.emit('roomslist', { rooms: nameOfRooms, numClients: countClientsInRooms(nameOfRooms), createTime: createTimeOfRooms, creator: creatorOfRooms, passFlag: passwordFlagOfRooms });
}

// 'sockets.manager.rooms' is an object that holds
// the active room names as a key, returning array of
// room names
function getRooms(){
	return Object.keys(io.sockets.adapter.rooms);
}

var countClientsInRoom = function(roomName, namespace) {
    if (!namespace) namespace = '/';
    var room = io.nsps[namespace].adapter.rooms[roomName];
    if (!room) return null;
    return Object.keys(room).length;
}

// get the amount of clients in aroom

// get the amount of clients in all active rooms, return an object that holds the room name as key
// and an array of the number of clients in rooms
function countClientsInRooms(rooms){
	var numRooms = rooms.length;
	var numClients = [];
	for (var j = 0, len = rooms.length; j < len; j++){
		var roomname = rooms[j];
		var roomname_new = roomname.replace('/', '');
		numClients.push(countClientsInRoom(roomname_new));
	}
	return numClients;
}

// unique id generator
function generateId(){
	var S4 = function () {
		return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
	};
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

// return a short time format for the messages
function getTime(){
        var date = new Date();
        return (date.getHours() < 10 ? '0' + date.getHours().toString() : date.getHours()) + ':' +
                        (date.getMinutes() < 10 ? '0' + date.getMinutes().toString() : date.getMinutes());
}

function getSocketIdByName(name) {
	for(var socketID in chatClients){
		if (chatClients[socketID].nickname == name) {
			return socketID;
		}
	}
	return null;
}

// show a message in console
console.log('Chat server is running and listening to port %d...', port);
