const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';

console.log('Testing socket connection...');

// First initialize the socket server
fetch(`${BASE_URL}/api/socket`).then(() => {
  console.log('Socket server initialized');
}).catch(console.error);

const socket = io(BASE_URL, {
  transports: ['websocket', 'polling'],
  timeout: 10000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ Socket connected successfully:', socket.id);
  
  // Test basic socket functionality
  socket.emit('test-event', { message: 'Hello from test' });
  
  setTimeout(() => {
    socket.disconnect();
    console.log('✅ Socket disconnected');
    process.exit(0);
  }, 1000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket connection error:', error);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

// Timeout after 15 seconds
setTimeout(() => {
  console.error('❌ Socket connection timeout');
  process.exit(1);
}, 15000); 