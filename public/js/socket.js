// Thin wrapper around Socket.io client
// Exposes: socket (the raw io instance), on(event, cb), emit(event, data), offAll(event)
// Connects to window.location.origin
// Exports { socket, on, emit, offAll }

const socket = io(window.location.origin);

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
});

export const on = (event, cb) => socket.on(event, cb);
export const emit = (event, data) => socket.emit(event, data);
export const offAll = (event) => socket.off(event);
export { socket };
