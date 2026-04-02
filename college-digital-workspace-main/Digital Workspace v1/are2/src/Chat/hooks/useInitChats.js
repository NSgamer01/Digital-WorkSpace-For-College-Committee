import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ensureSystemChats } from '../../services/chatService';

// ── useInitChats ────────────────────────────────────────────────
// Runs once on mount to ensure "announcement" and "general"
// chat documents exist in the backend.
// Uses a ref to prevent duplicate initialization across re-renders.

const useInitChats = () => {
    const initialized = useRef(false);
    const { user } = useAuth();

    useEffect(() => {
        if (initialized.current) return;
        if (!user) return;

        initialized.current = true;

        const init = async () => {
            try {
                await ensureSystemChats(user.id);
            } catch (error) {
                console.error('❌ useInitChats: Failed to initialize system chats:', error);
            }
        };

        init();
    }, [user]);
};

export default useInitChats;
