// ============================================
// src/components/TypingIndicator.jsx — Typing Display
// ============================================
// Shows "{user} is typing..." or "{count} people are typing..."
// with animated dots. Watches Firestore for typing state.
// ============================================

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const PRESENCE_COLLECTION = 'user_presence';

const TypingIndicator = ({ roomId, currentUserId, userNames = {} }) => {
    const [typingUsers, setTypingUsers] = useState([]);

    useEffect(() => {
        if (!roomId) return;

        // Listen to all presence docs where isTyping=true and typingIn=roomId
        // Since Firestore doesn't support compound queries across different fields easily,
        // we'll listen to the entire collection and filter client-side
        const presenceRef = collection(db, PRESENCE_COLLECTION);
        const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
            const typing = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (
                    data.isTyping &&
                    data.typingIn === roomId &&
                    data.userId !== currentUserId
                ) {
                    typing.push({
                        userId: data.userId,
                        name: userNames[data.userId] || 'Someone',
                    });
                }
            });
            setTypingUsers(typing);
        });

        return () => unsubscribe();
    }, [roomId, currentUserId, JSON.stringify(userNames)]);

    if (typingUsers.length === 0) return null;

    const text = typingUsers.length === 1
        ? `${typingUsers[0].name} is typing`
        : typingUsers.length === 2
            ? `${typingUsers[0].name} and ${typingUsers[1].name} are typing`
            : `${typingUsers.length} people are typing`;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            fontSize: 12,
            color: 'var(--textTertiary)',
            fontStyle: 'italic',
        }}>
            <span>{text}</span>
            <span className="typing-dots" style={{
                display: 'inline-flex',
                gap: 2,
            }}>
                <span style={{ animation: 'typingBounce 1.4s infinite ease-in-out', animationDelay: '0s' }}>●</span>
                <span style={{ animation: 'typingBounce 1.4s infinite ease-in-out', animationDelay: '0.2s' }}>●</span>
                <span style={{ animation: 'typingBounce 1.4s infinite ease-in-out', animationDelay: '0.4s' }}>●</span>
            </span>

            <style>{`
                @keyframes typingBounce {
                    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                    30% { transform: translateY(-4px); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default TypingIndicator;
