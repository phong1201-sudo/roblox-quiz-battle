// Thin wrapper around Socket.io client
// Exposes: socket (the raw io instance), on(event, cb), emit(event, data), offAll(event)
// Connects to window.location.origin
// Exports { socket, on, emit, offAll }

const socket = (typeof io !== 'undefined') ? io(window.location.origin) : {
    on: () => {},
    off: () => {},
    emit: () => {},
};

if (socket.on) {
    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
    });
}

// Track registered handlers per event. Several modules (main.js, multiplayer.js)
// listen to the same events, so every distinct handler must stay registered;
// only registering the very same function twice is ignored (prevents stacking).
const _handlers = {};
export function on(event, cb) {
    const list = _handlers[event] || (_handlers[event] = new Set());
    if (list.has(cb)) return;
    list.add(cb);
    socket.on(event, cb);
}
export const emit   = (event, data) => socket.emit(event, data);
export const offAll = (event)       => { socket.off(event); delete _handlers[event]; };
export { socket };
