const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "https://chat-task-2kh2.vercel.app/",
    methods: ["GET", "POST"]
  }
});
const roomData = {};
io.on('connection', (socket) => {
  console.log(`New user connected: ${socket.id}`);
  let currentRoom = null;
  let username = null;

  socket.on('join_room', (data) => {
    const { roomId, userName } = data;
    currentRoom = roomId;
    username = userName || `User${socket.id.substr(0, 4)}`;

    if (!roomData[roomId]) {
      roomData[roomId] = {
        messages: [],
        users: new Set()
      };
    }
    roomData[roomId].users.add(username);
    socket.join(roomId);
    const joinMessage = {
      type: 'system',
      content: `${username} has joined the room`,
      timestamp: new Date().toISOString()
    };
    roomData[roomId].messages.push(joinMessage);
    socket.emit('message_history', roomData[roomId].messages);
    socket.to(roomId).emit('receive_message', joinMessage);
    console.log(`${username} joined room ${roomId}`);
  });

  socket.on('send_message', (data) => {
    if (!currentRoom) return;
    
    const messageWithMetadata = {
      ...data,
      type: 'user',
      sender: username,
      timestamp: new Date().toISOString(),
      isCurrentUser: false 
    };
    roomData[currentRoom].messages.push(messageWithMetadata);
    socket.to(currentRoom).emit('receive_message', messageWithMetadata);
    socket.emit('receive_message', {
      ...messageWithMetadata,
      isCurrentUser: true
    });
  });

  socket.on('disconnect', () => {
    if (currentRoom && username) {
      roomData[currentRoom]?.users?.delete(username);
      const leaveMessage = {
        type: 'system',
        content: `${username} has left the room`,
        timestamp: new Date().toISOString()
      };
      if (roomData[currentRoom]) {
        roomData[currentRoom].messages.push(leaveMessage);
      }
      io.to(currentRoom).emit('receive_message', leaveMessage);
      console.log(`${username} left room ${currentRoom}`);
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});