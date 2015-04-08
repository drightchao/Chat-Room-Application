// chatroom.io.js
var socket = null;
var clientId = null;
var nickname = null;
var NICK_MAX_LENGTH = 15;
var ROOM_MAX_LENGTH = 10;

// holds the current room we are in
var currentRoom = null;
var flag = 0;

// server information
var serverAddress = 'http://54.68.40.157:8080';
var serverDisplayName = 'Server';
var serverDisplayColor = '#1c5380';


//signon();
// now that we have the socket we can bind events to it
	
// bindSocketEvents
function bindSocketEvents() {
    // when the connection is made, the server emiting
    // the 'connect' event
    flag = 1;
    socket.on('connect', function(){
        flag = 2;
        // firing back the connect event to the server
        // and sending the nickname for the connected client
        socket.emit('connectted', { nickname: nickname });
        flag = 3;
    });
    
    // after the server created a client for us, the ready event
    // is fired in the server with our clientId, now we can start 
    socket.on('ready', function(data){
        flag = 4;
        // saving the clientId localy
        clientId = data.clientId;
    });
    
    // after the initialize, the server sends a list of
    // all the active rooms
    socket.on('roomslist', function(data){
        room_list_head_dom();
        for(var i = 0, len = data.rooms.length; i < len; i++){
                // in socket.io, their is always one default room
                // without a name (empty string), every socket is automaticaly
                // joined to this room, however, we don't want this room to be
                // displayed in the rooms list
                var room = data.rooms[i];
                if(room != ''){
                    addRoom(room, data.numClients[i], data.creator[i], data.createTime[i], data.passFlag[i], false, i);
                }
        }
    });
    
    // when someone sends a message, the sever push it to
    // our client through this event with a relevant data
    socket.on('displaypvtmessage', function(data){
            var nickname = data.client.nickname;
            var message = data.message;
            //display the message in the chat window
            insertPvtMessage(nickname, message, true, false, false);
    });
    
        // when someone sends a message, the sever push it to
    // our client through this event with a relevant data
    socket.on('displaychatmessage', function(data){
            var nickname = data.client.nickname;
            var message = data.message;
            var room = data.room;
            var isPublicMessage = false;
            //display the message in the chat window
            room = room.replace('/','');
            if (room == "lobby") {
                isPublicMessage = true;
            }
            insertMessage(nickname, message, true, false, false, isPublicMessage);
    });
    
    
    // with this event the server tells us when a client
    // is connected or disconnected to the current room
    socket.on('presence', function(data){
            if(data.state == 'online'){
                    addClient(data.client, true);
            } else if(data.state == 'offline'){
                    removeClient(data.client, true);
            }
    });
    
    socket.on('addroom', function(data){
        if ((currentRoom == null) && (nickname != data.creator)) {
            // the current client is not subscribed to any room, display the new room in the list
            //addNewRoom(data);
            socket.emit('update_roomlist');
        }
        //if (nickname == data.creator) {
            // subscribe the creator to the room he created
          //  joinRoom(data);
        //}
        // server tell everyone a new room is created
        insertMessage(serverDisplayName, 'A new room: (' + data.room + ') has been created.', true, false, true, true);
    });
    
    socket.on('updateRoominfo', function(data){
        if ((currentRoom == null) && (nickname != data.creator)) {
            // the current client is not subscribed to any room, display the new room in the list
            //addNewRoom(data);
            socket.emit('update_roomlist');
        }
        //if (nickname == data.creator) {
            // subscribe the creator to the room he created
          //  joinRoom(data);
        //}
        // server tell everyone a new room is created
        //insertMessage(serverDisplayName, 'A new room: (' + data.room + ') has been created.', true, false, true, true);
    });
    
    // when we subscribes to a room, the server sends a list
    // with the clients in this room
    socket.on('roomclients', function(data){
            
            // add the room name to the rooms list
          //  addRoom(data.room, false);

            // set the current room
           // setCurrentRoom(data.room);
           currentRoom = data.room;
            // write dom inside the room
                
            roomChatDom();
            // announce a welcome message in the room
            insertMessage(serverDisplayName, 'Welcome to the room: `' + data.room + '`... enjoy!', true, false, true, false);
          //  $('.chat-clients ul').empty();
            delete_dom(document.getElementById("client_list"));
            // add the clients to the clients list
            addClient({ nickname: nickname, clientId: clientId, creator: data.creator }, false, true);
            for(var i = 0, len = data.clients.length; i < len; i++){
                    if(data.clients[i] != null){
                            addClient({nickname: data.clients[i].nickname, clientId: data.clients[i].clientId, creator: data.creator}, false);
                    }
            }
    });
    
    socket.on('joinFail', function(data){
        alert(data.message);
    });
    
    socket.on("pvgmsgres", function(data){
	if (!data.flag) {
	    alert(data.friend + ' not found!');
	}else{
	    if (!data.success) {
		alert(data.friend + ' is chatting with others.');
	    }else{
		var friend_input_text = document.getElementById('friend_input');
		var friend_input_btn = document.getElementById('friend_button');
		friend_input_text.value = 'Waiting for ' + data.friend + ' to confirm.';
		friend_input_text.disabled = true;
		friend_input_btn.disabled = true;
	    }
	}
	
    });
    
    socket.on("pvgmsgconf", function(data){
	if(data.agree){
	    var friend = data.friend;
	    alert(friend + ' agreed to chat with you. Enjoy!');
	    startPvtChatWith(friend);
	    
	}else{
	    var friend = data.friend;
	    alert(friend + ' refused to chat with you. Sorry!');
	    resetPvtChat();
	}
	
    });
    
    socket.on("pvtmsgreqserver", function(data){
	var friend = data.from;
	document.getElementById('pvtmsgreqcfmfn').innerHTML = friend;
	$("#pvtmsgreqcfm").dialog();
    });
    
    socket.on('pvtmsgendserver', function(data){
	alert(data.friend+" has ended this chat.");
	resetPvtChat();
    });
    
}

function  roomChatDom() {
    // write the chat area and leave button
    // change the legend to the current room name
    document.getElementById("room_display_name").innerHTML = currentRoom;
    delete_dom(document.getElementById("room_list")); // delete the content of the room list
    
    var insideRoomDom = document.getElementById("inside_room");
    var leaveBtnDom = document.createElement("button");
    leaveBtnDom.setAttribute("type", "button");
    leaveBtnDom.setAttribute("id", "leaveBtn");
    leaveBtnDom.appendChild(document.createTextNode("Leave"));
    insideRoomDom.appendChild(leaveBtnDom);
    
    var formMsgDom = document.createElement("form");
    formMsgDom.setAttribute("id", "room_message");
    var inputDom = document.createElement("input");
    inputDom.setAttribute("type", "text");
    inputDom.setAttribute("id", "message_input_room");
    formMsgDom.appendChild(inputDom);
    
    var sendMsgBtnDom = document.createElement("button");
    sendMsgBtnDom.setAttribute("type", "button");
    sendMsgBtnDom.setAttribute("id", "sendRoomMsgBtn");
    sendMsgBtnDom.appendChild(document.createTextNode("Send"));
    sendMsgBtnDom.addEventListener("click", sendRoomMessage, false);
    formMsgDom.appendChild(sendMsgBtnDom);
    insideRoomDom.appendChild(formMsgDom);
    insideRoomDom.appendChild(document.createElement("br"));
    
    var chatlogDivDom = document.createElement("div");
    chatlogDivDom.setAttribute("id", "chatlog_room");
    insideRoomDom.appendChild(chatlogDivDom);
    
    var clientListFieldDom = document.createElement("fieldset");
    clientListFieldDom.setAttribute("id","client_list");
    var legendDom = document.createElement("legend");
    legendDom.innerHTML = "Clients List";
    clientListFieldDom.appendChild(legendDom);
    insideRoomDom.appendChild(clientListFieldDom);
}


function addNewRoom(data) {
    var room_list_body = document.getElementById("room_list_body");
    var trDom = document.createElement("tr");
    
    var tdNameDom = document.createElement("td");
    var spanNameDom = document.createElement("span");
    spanNameDom.setAttribute("class","room_name");
    spanNameDom.appendChild(document.createTextNode(data.room));
    tdNameDom.appendChild(spanNameDom);
    trDom.appendChild(tdNameDom);
    
    var tdTimeDom = document.createElement("td");
    var spanTimeDom = document.createElement("span");
    spanTimeDom.appendChild(document.createTextNode(data.createTime));
    tdTimeDom.appendChild(spanTimeDom);
    trDom.appendChild(tdTimeDom);
    
    var tdNumDom = document.createElement("td");
    var spanNumDom = document.createElement("span");
    spanNumDom.appendChild(document.createTextNode(data.numClients));
    tdNumDom.appendChild(spanNumDom);
    trDom.appendChild(tdNumDom);
    
    var tdCreatorDom = document.createElement("td");
    var spanCreatorDom = document.createElement("span");
    spanCreatorDom.appendChild(document.createTextNode(data.creator));
    tdCreatorDom.appendChild(spanCreatorDom);
    trDom.appendChild(tdCreatorDom);
    
    var tdPassDom = document.createElement("td");
    var spanPassDom = document.createElement("span");
    if (data.passFlag) {
        spanPassDom.appendChild(document.createTextNode("Private"));
    }else{
        spanPassDom.appendChild(document.createTextNode("Public"));
    }
    tdPassDom.appendChild(spanPassDom);
    trDom.appendChild(tdPassDom);
    
    var tdJoinDom = document.createElement("td");
    var btnJoinDom = document.createElement("button");
    btnJoinDom.addEventListener("click", function(){
            joinRoom(data);
        }, false);
    btnJoinDom.setAttribute("type", "button");
    btnJoinDom.setAttribute("class", data.room);
    btnJoinDom.setAttribute("id", data.creator);
    btnJoinDom.innerHTML = "Join";
    tdJoinDom.appendChild(btnJoinDom);
    trDom.appendChild(tdJoinDom);
    
    room_list_body.appendChild(trDom);
    
}

function joinRoom(data) {
    //socket.emit("subscribe", {})
    if (data.passFlag) {
        // require password
        if (nickname == data.creator) {
        // don't need prompt password
        socket.emit("subscribe", {nickname: nickname, room: data.room, flag: false, index: data.index, flagNewRoom: false, creator: nickname });
        }else{
            // password input requred
            var passwordInput = prompt("Please input the password of " + data.room, "");
            socket.emit("subscribe", {nickname: nickname, room: data.room, flag: true, password: passwordInput, index: data.index, flagNewRoom: false, creator: nickname });
        }
    }else{
        socket.emit("subscribe", {nickname: nickname, room: data.room, flag: false, index: data.index, flagNewRoom: false, creator: nickname });
    }
}

// add a client to the clients list
function addClient(client, announce, isMe){
    // show client list
    var clientListFieldDom = document.getElementById("client_list");
    var hrDom = document.createElement("hr");
    var spanDom = document.createElement("span");
    var clientName = document.createTextNode(client.nickname);
    spanDom.appendChild(clientName);
    hrDom.appendChild(spanDom);
    // if this is our client, mark him with color blue
    if(isMe){
        spanDom.setAttribute("style","color: blue;");
    }
    
    // if this client is the creator of this room, and the client to be added is not itself, display the kick and ban button
    if ((nickname == client.creator)&&(client.nickname != nickname)) {
        spanDom.setAttribute("style","color: red;");
        var banBtnDom = document.createElement("button");
        banBtnDom.setAttribute("type","button");
        banBtnDom.setAttribute("class","banBtn");
        banBtnDom.appendChild(document.createTextNode("Ban"));
        hrDom.appendChild(banBtnDom);
        
        var kickBtnDom = document.createElement("button");
        kickBtnDom.setAttribute("type","button");
        kickBtnDom.setAttribute("class","kickBtn");
        kickBtnDom.appendChild(document.createTextNode("Kick"));
        hrDom.appendChild(kickBtnDom);
    }
    
    clientListFieldDom.appendChild(hrDom);
        
        // if this is the creator, mark him with color red
        
        // if announce is true, show a message about this client
        if(announce){
                insertMessage(serverDisplayName, client.nickname + ' has joined the room...', true, false, true, false);
        }
       // $html.appendTo('.chat-clients ul')
}

// remove a client from the clients list
function removeClient(client, announce){
        //$('.chat-clients ul li[data-clientId="' + client.clientId + '"]').remove();
        // delete the client from the list
        
        // if announce is true, show a message about this room
        if(announce){
                insertMessage(serverDisplayName, client.nickname + ' has left the room...', true, false, true, false);
        }
}

function room_list_head_dom() {
    var list_head = document.getElementById("room_list");
    delete_dom(list_head);
    
    var tableDom = document.createElement("table");
    tableDom.setAttribute("id", "room_list_table");
    tableDom.setAttribute("style", "width:90%")
    
    var theadDom = document.createElement("thead");
    var trDom = document.createElement("tr");
    
    var nameDom = document.createElement("th");
    var uNameDom = document.createElement("u");
    uNameDom.appendChild(document.createTextNode("Room Name"));
    nameDom.appendChild(uNameDom);
    trDom.appendChild(nameDom);
    
    var timeDom = document.createElement("th");
    var uTimeDom = document.createElement("u");
    uTimeDom.appendChild(document.createTextNode("Create Time"));
    timeDom.appendChild(uTimeDom);
    trDom.appendChild(timeDom);

    var numDom = document.createElement("th");
    var uNumDom = document.createElement("u");
    uNumDom.appendChild(document.createTextNode("Number of People"));
    numDom.appendChild(uNumDom);
    trDom.appendChild(numDom);
    
    var creatorDom = document.createElement("th");
    var uCreatorDom = document.createElement("u");
    uCreatorDom.appendChild(document.createTextNode("Creator"));
    creatorDom.appendChild(uCreatorDom);
    trDom.appendChild(creatorDom);
    
    var passDom = document.createElement("th");
    var uPassDom = document.createElement("u");
    uPassDom.appendChild(document.createTextNode("Password"));
    passDom.appendChild(uPassDom);
    trDom.appendChild(passDom);
    
    theadDom.appendChild(trDom);
    tableDom.appendChild(theadDom);
    
    var tbodyDom = document.createElement("tbody");
    tbodyDom.setAttribute("id", "room_list_body");
    tableDom.appendChild(tbodyDom);
    list_head.appendChild(tableDom);
}


// remove a room from the rooms list
function removeRoom(name, announce){
      //  $('.chat-rooms ul li[data-roomId="' + name + '"]').remove();
      // remove the room from the list
      
      // if the current client is in a room, don't update the roomlist until they unsubscribe from the room
      // if the current client is not in any room, call update his/her roomlist
      
        // if announce is true, show a message about this room
        if(announce){
                insertMessage(serverDisplayName, 'The room `' + name + '` destroyed...', true, false, true, true);
        }
}

// add a room to the rooms list, socket.io may add
// a trailing '/' to the name so we are clearing it
function addRoom(name, numClientInRoom, creator, createTime, passFlag, announce, index){
        // clear the trailing '/'
        name = name.replace('/','');

        // check if the room is not already in the list
        var rooms_in_list = document.getElementsByClassName("room_name");
        if (rooms_in_list.length == 0) { // if there is not any room, just add this room to the list
            var data = {room: name, numClients: numClientInRoom, creator: creator, createTime: createTime, passFlag: passFlag, index: index};
            addNewRoom(data);
            // if announce is true, show a message about this room
            if(announce){
                insertMessage(serverDisplayName, 'The room `' + name + '` created...', true, false, true, true);
            }
        }else{
            // if there are some rooms, check whether this to be added room already exists.
            var countRoom = 0;
            for (var i=0, len=rooms_in_list.length; i<len; i++){
                if (name == rooms_in_list[i].innerHTML) {
                    countRoom++;
                }
            }
            if(countRoom == 0){
                    var data = {room: name, numClients: numClientInRoom, creator: creator, createTime: createTime, passFlag: passFlag, index: index};
                    addNewRoom(data);
                    // if announce is true, show a message about this room
                    if(announce){
                        insertMessage(serverDisplayName, 'The room `' + name + '` created...', true, false, true, true);
                    }
            }   
        }
}

// handle the client messages
function handleMessage(isPublic){
    if (isPublic) {
        var message = document.getElementById("message_input").value.trim();
        while(message == ""){
            message = prompt("Your message can't be empty!");
            document.getElementById("message_input").value = message;
        }

        // send the message to the server with the room name
        socket.emit('chatmessage', { message: message, room: 'lobby' });
        
        // display the message in the chat window
        insertMessage(nickname, message, true, true, false, true);
        document.getElementById("message_input").value = "";
    }else{
        var message = document.getElementById("message_input_room").value.trim();
        while(message == ""){
            message = prompt("Your message can't be empty!");
            document.getElementById("message_input_room").value = message;
        }
        // send the message to the server with the room name
        socket.emit('chatmessage', { message: message, room: currentRoom });
        
        // display the message in the chat window
        insertMessage(nickname, message, true, true, false, false);
        document.getElementById("message_input_room").value = "";    
    }
}

// insert a message to the chat window, this function can be
// called with some flags
function insertMessage(sender, message, showTime, isMe, isServer, isPublic){
    // add message to the website in lobby or a specific room
    var chatlogDom;
    if (isPublic) {
        // send this message to lobby
        chatlogDom = document.getElementById("chatlog");
    }else{
        chatlogDom = document.getElementById("chatlog_room");
    }
    var divDom = document.createElement("div");
    divDom.setAttribute("class", "chatmessage");
    var hrDom = document.createElement("hr");
    var spanNameDom = document.createElement("span");
    spanNameDom.appendChild(document.createTextNode(sender + ":"));
    // if this message is from server, display the name in red bold;
    if (isServer) {
        spanNameDom.setAttribute("style", "color: red; font-weight: bold;");
    }
    // if this message is from this client, display the name in blue bold;
    if (isMe) {
        spanNameDom.setAttribute("style", "color: blue;")
    }
    hrDom.appendChild(spanNameDom);
    // display all time in yellow.
    var spanTimeDom = document.createElement("span");
    spanTimeDom.appendChild(document.createTextNode(' (' + getTime() + ')'));
    spanTimeDom.setAttribute("style", "color: orange;");
    hrDom.appendChild(spanTimeDom);
    hrDom.appendChild(document.createElement("br")); // change line to display the message
    hrDom.appendChild(document.createTextNode(message));
    divDom.appendChild(hrDom)
    chatlogDom.appendChild(divDom);
    divDom.scrollIntoView();   
}

function privateMessage(){
        var message = document.getElementById("pvt_message_input").value.trim();
        if(message != ""){

                // send the message to the server with the room name
                socket.emit('pvtchatmessage', { message: message});
                
                // display the message in the chat window
                insertPvtMessage(nickname, message, true, true, false);
                document.getElementById("pvt_message_input").value = "";
        } else {
                prompt("Your message input can not be empty!");
        }
}

function insertPvtMessage(sender, message, showTime, isMe, isServer){
    // add message to the website in lobby or a specific room
        // send this message to lobby
        var chatlogDom = document.getElementById("privatechatlog");
        var hrDom = document.createElement("hr");
        var spanNameDom = document.createElement("span");
        spanNameDom.appendChild(document.createTextNode(sender + ":"));
        // if this message is from server, display the name in red bold;
        if (isServer) {
            spanNameDom.setAttribute("style", "color: red; font-weight: bold;");
        }
        // if this message is from this client, display the name in blue bold;
        if (isMe) {
            spanNameDom.setAttribute("style", "color: blue;")
        }
        hrDom.appendChild(spanNameDom);
        // display all time in yellow.
        var spanTimeDom = document.createElement("span");
        spanTimeDom.appendChild(document.createTextNode(' (' + getTime() + ')'));
        spanTimeDom.setAttribute("style", "color: orange;");
        hrDom.appendChild(spanTimeDom);
        hrDom.appendChild(document.createElement("br")); // change line to display the message
        hrDom.appendChild(document.createTextNode(message));
        chatlogDom.appendChild(hrDom);
        
}

// return a short time format for the messages
function getTime(){
        var date = new Date();
        return (date.getHours() < 10 ? '0' + date.getHours().toString() : date.getHours()) + ':' +
                        (date.getMinutes() < 10 ? '0' + date.getMinutes().toString() : date.getMinutes());
}

function showCreateRoomDial()
{
  $("#create_room_dial").dialog();
}
function closeCrRmDial() {
    $("#create_room_dial").dialog('close');
}
function passCheckClicked()
{
        var pass_check = document.getElementById("pass_or_not_check").checked;
        var pass_input = document.getElementById("password_create_input");
        if(pass_check){
                pass_input.disabled = false;
        }else{
		pass_input.disabled = true;	
	}
}

function signon() {
        nickname = prompt("Please enter a nickname to start...","Note: can't be empty and no more than 15 characters!");
        while((nickname.trim() == "") || (nickname.trim().length > NICK_MAX_LENGTH)){
                nickname = prompt("Error: Illegal nick name! Enter again:","Note: can't be empty and no more than 15 characters!");
        }
       // nickname = nick;
        // connect with database
        // creating the connection and saving the socket
        socket = io.connect(serverAddress);
	document.getElementById("username").innerHTML = nickname.trim();
        bindSocketEvents();
}
//room_list_head_dom();

function createRoomDial() {
        var roomname = document.getElementById("room_name_input").value;
        var passcheck = document.getElementById("pass_or_not_check").checked;
        while((roomname == '') || (roomname == 'lobby') || (roomname.length > ROOM_MAX_LENGTH)){
                roomname = prompt("Error: Illegal room name! Enter again:", "Note: The name can't be 'lobby' or empty! And no more than 10 characters!");
                document.getElementById("room_name_input").value = roomname;
        }
        if(roomname !="") {
                if (!passcheck){
                        socket.emit("create_room_to_server", {room:roomname, currentSubscribed: currentRoom, creator: nickname, flag:false, flagNewRoom: true});
                        currentRoom = roomname;
                }
                else {
                        var passcode = document.getElementById("password_create_input").value;
                        while((passcode == '') || (passcode.length > ROOM_MAX_LENGTH)){
                            passcode = prompt("Error: Illegal password! Enter again:", "Note: The password can't be empty! And no more than 10 characters!");
                            document.getElementById("password_create_input").value = passcode;
                        }
                        socket.emit("create_room_to_server", {room:roomname, currentSubscribed: currentRoom, creator: nickname, flag:true, password:passcode, flagNewRoom: true});
                        currentRoom = roomname;
                }
        }
	closeCrRmDial();
}

function pvtmsgreq(){
    var friend = document.getElementById("friend_input").value;
    if (friend) {
	socket.emit("pvtmsgreq", {nickname:nickname, friend:friend});
    }
    else{
	alert("Friend name cannot be empty!");
    }
}

function pvtmsgreqcfmyes(){
    var friend = document.getElementById("pvtmsgreqcfmfn").value;
    socket.emit("pvtmsgreqconf", {confirm:true, friend:friend});
    $("#pvtmsgreqcfm").dialog(close);
}

function pvtmsgreqcfmno(){
    var friend = document.getElementById("pvtmsgreqcfmfn").value;
    socket.emit("pvtmsgreqconf", {confirm:false, friend:friend});
    $("#pvtmsgreqcfm").dialog(close);
}

function endPvtChat(){
    socket.emit('pvtmsgend');
    resetPvtChat();
}

function sendPublicMessage(){
        handleMessage(true);
}

function sendRoomMessage(){
        handleMessage(false);
}

function sendPvtMessage(){
	privateMessage();
}

function resetPvtChat(){
	document.getElementById("pvt_message_box").hidden = true;
	document.getElementById("chatlog").style.height = "550px";
}

function startPvtChatWith(friend){
	
	document.getElementById("chatlog").style.height = "330px";
	document.getElementById("pvt_message_box").hidden = false;
}

$("#message_input").keypress(function(event){
    if(event.keyCode == 13){
        event.preventDefault();
        $("#sendPubMsgBtn").click();
    }
});

$("#friend_input").keypress(function(event){
    if(event.keyCode == 13){
        event.preventDefault();
        $("#pvt_chat_req_btn").click();
    }
});
    
$("#room_message_input").keypress(function(event){
    if(event.keyCode == 13){
        event.preventDefault();
        $("#sendRoomMsgBtn").click();
    }
});
document.addEventListener("DOMContentLoaded", signon, false);


