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

// Track registered handlers per event so we can remove-before-add (prevent stacking)
const _handlers = {};
export function on(event, cb) {
    // Remove any previous handler for this event to prevent listener accumulation
    if (_handlers[event]) socket.off(event, _handlers[event]);
    _handlers[event] = cb;
    socket.on(event, cb);
}
export const emit   = (event, data) => socket.emit(event, data);
export const offAll = (event)       => { socket.off(event); delete _handlers[event]; };
export { socket };
