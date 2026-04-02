import { auth, rtdb } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, set, onValue, onDisconnect, serverTimestamp } from 'firebase/database';

/**
 * Initialize real-time presence tracking.
 * Call this ONCE globally (in App.jsx useEffect).
 */
export function initializePresence() {
    console.log('🔵 initializePresence() called');
    console.log('🔵 RTDB instance:', rtdb);

    onAuthStateChanged(auth, (user) => {
        console.log('🔵 onAuthStateChanged fired. User:', user?.uid || 'null');

        if (!user) {
            console.log('🔵 No user — skipping presence setup');
            return;
        }

        const userStatusRef = ref(rtdb, 'status/' + user.uid);
        const connectedRef = ref(rtdb, '.info/connected');

        console.log('🔵 Setting up .info/connected listener for', user.uid);

        onValue(connectedRef, (snapshot) => {
            console.log('🔵 .info/connected =', snapshot.val());

            if (snapshot.val() === false) {
                return;
            }

            // When we disconnect, write offline status
            onDisconnect(userStatusRef).set({
                state: 'offline',
                last_changed: serverTimestamp(),
            });

            // Set current status to online
            set(userStatusRef, {
                state: 'online',
                last_changed: serverTimestamp(),
            }).then(() => {
                console.log('✅ Presence set to ONLINE for', user.uid);
            }).catch((err) => {
                console.error('❌ Error setting presence:', err);
            });
        });
    });
}
