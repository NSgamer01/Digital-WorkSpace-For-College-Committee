// ── usePresence ─────────────────────────────────────────────────
// Placeholder hook — presence tracking requires WebSocket/Socket.IO
// which is not yet implemented with the PostgreSQL backend.
//
// Previously used Firebase Realtime Database for online/offline status.
// To re-enable presence, implement a WebSocket connection that writes
// to a presence table or broadcasts status to connected clients.

const usePresence = () => {
    // No-op: presence tracking disabled until WebSocket is implemented
};

export default usePresence;
