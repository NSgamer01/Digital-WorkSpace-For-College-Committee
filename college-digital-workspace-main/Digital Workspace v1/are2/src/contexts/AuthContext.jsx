// ============================================
// contexts/AuthContext.jsx — Firebase Auth + PostgreSQL Sync
// ============================================
//
// FIREBASE CONSOLE SETUP — DO THESE BEFORE RUNNING THE APP:
//
// 1. Go to https://console.firebase.google.com/
// 2. Select your project (or create one)
//
// 3. ENABLE EMAIL/PASSWORD AUTH (THIS IS THE #1 CAUSE OF auth/invalid-email):
//    → Click "Authentication" in left sidebar
//    → Click "Sign-in method" tab
//    → Click "Email/Password" row
//    → Toggle BOTH switches to ENABLED:
//       ✅ Email/Password
//       ✅ Email link (passwordless sign-in) [optional]
//    → Click "Save"
//
// 4. GET YOUR CONFIG:
//    → Click gear icon → "Project settings"
//    → Scroll down to "Your apps" → "Web app"
//    → If no web app exists, click "Add app" → Web → register
//    → Copy the firebaseConfig object values into your .env file
//
// 5. SET UP FIRESTORE (for presence system only):
//    → Click "Firestore Database" in left sidebar
//    → Click "Create database"
//    → Start in "test mode" for development
//    → Select region closest to you
//
// If you get "auth/operation-not-allowed", Step 3 was not done.
// If you get "auth/invalid-email", check that:
//   - Step 3 was done
//   - Email is trimmed (no whitespace)
//   - .env variables are correct and server was restarted
//
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    subscribeToAuthChanges,
    loginUser,
    registerUser,
    logoutUser,
    resetPassword as resetPasswordService,
} from '../services/authService';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Firebase error code → user-friendly message ──
function getFirebaseErrorMessage(error) {
    const code = error?.code || '';
    const map = {
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/user-disabled': 'This account has been disabled. Contact your administrator.',
        'auth/user-not-found': 'No account found with this email. Please sign up first.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/email-already-in-use': 'An account with this email already exists. Please log in.',
        'auth/weak-password': 'Password must be at least 6 characters long.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your internet connection.',
        'auth/operation-not-allowed':
            'Email/Password sign-in is not enabled. Please contact the administrator to enable it in Firebase Console → Authentication → Sign-in method.',
        'auth/internal-error': 'An internal error occurred. Please try again.',
        'auth/invalid-credential': 'Invalid email or password. Please try again.',
    };
    return map[code] || `Authentication error: ${error.message}`;
}

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);                // PostgreSQL user profile
    const [firebaseUser, setFirebaseUser] = useState(null); // Raw Firebase user
    const [committees, setCommittees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [error, setError] = useState(null);

    // ── Helper: Make API request with token ──
    const apiRequest = useCallback(async (method, path, body = null, token = null) => {
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body) headers['Content-Type'] = 'application/json';

        const slug = localStorage.getItem('currentCommitteeSlug');
        if (slug) headers['X-Committee-Slug'] = slug;

        const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);

        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Request failed (${response.status})`);
        }
        return data;
    }, []);

    // ── Listen to Firebase auth state changes (handles page refresh) ──
    useEffect(() => {
        const unsubscribe = subscribeToAuthChanges(async (fbUser) => {
            if (fbUser) {
                setFirebaseUser(fbUser);
                setIsAuthenticated(true);

                try {
                    // Get fresh token and store it
                    const token = await fbUser.getIdToken();
                    localStorage.setItem('token', token);

                    // Fetch profile from backend
                    const data = await apiRequest('GET', '/auth/me', null, token);
                    if (data.success) {
                        setUser(data.user);
                        setCommittees(data.committees || []);
                    }
                } catch (err) {
                    console.warn('Backend profile fetch failed (user may not be registered yet):', err.message);
                    // Firebase user exists but not in PostgreSQL — edge case
                    // Set minimal user data from Firebase so the app doesn't break
                    setUser({
                        email: fbUser.email,
                        name: fbUser.displayName || fbUser.email?.split('@')[0],
                        avatar: fbUser.photoURL,
                    });
                    setCommittees([]);
                }
            } else {
                setFirebaseUser(null);
                setUser(null);
                setCommittees([]);
                setIsAuthenticated(false);
                localStorage.removeItem('token');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [apiRequest]);

    // ── Register (signup) ──
    const register = useCallback(async (email, password, name) => {
        setError(null);
        try {
            // 1. Create Firebase auth account
            const fbUser = await registerUser(email, password, name);

            // 2. Get token
            const token = await fbUser.getIdToken();
            localStorage.setItem('token', token);

            // 3. Sync with PostgreSQL backend (authMiddleware upserts the user)
            const data = await apiRequest('POST', '/auth/sync', {
                firebaseUid: fbUser.uid,
                email: email.trim().toLowerCase(),
                name: (name || '').trim(),
            }, token);

            console.log('✅ PostgreSQL user synced:', data.user?.id);

            setUser(data.user);
            setCommittees(data.committees || []);
            setFirebaseUser(fbUser);
            setIsAuthenticated(true);

            return data;
        } catch (err) {
            console.error('❌ Register failed:', { code: err.code, message: err.message });
            const friendlyMessage = err.code ? getFirebaseErrorMessage(err) : err.message;
            setError(friendlyMessage);
            throw new Error(friendlyMessage);
        }
    }, [apiRequest]);

    // ── Login ──
    const login = useCallback(async (email, password) => {
        setError(null);
        try {
            // 1. Firebase sign in
            const fbUser = await loginUser(email, password);

            // 2. Get token
            const token = await fbUser.getIdToken();
            localStorage.setItem('token', token);

            // 3. Sync with PostgreSQL backend
            const data = await apiRequest('POST', '/auth/sync', {
                firebaseUid: fbUser.uid,
            }, token);

            setUser(data.user);
            setCommittees(data.committees || []);
            setFirebaseUser(fbUser);
            setIsAuthenticated(true);

            return data;
        } catch (err) {
            console.error('❌ Login failed:', { code: err.code, message: err.message });
            const friendlyMessage = err.code ? getFirebaseErrorMessage(err) : err.message;
            setError(friendlyMessage);
            throw new Error(friendlyMessage);
        }
    }, [apiRequest]);

    // ── Logout ──
    const logout = useCallback(async () => {
        try {
            await logoutUser();
        } catch (err) {
            console.error('Logout error:', err);
        }
        // Clear all stored data
        localStorage.removeItem('token');
        localStorage.removeItem('currentCommitteeSlug');
        localStorage.removeItem('currentCommitteeName');
        localStorage.removeItem('currentCommitteeColor');
        setUser(null);
        setFirebaseUser(null);
        setCommittees([]);
        setIsAuthenticated(false);
        setError(null);
    }, []);

    // ── Reset Password ──
    const resetPassword = useCallback(async (email) => {
        try {
            await resetPasswordService(email);
        } catch (err) {
            const friendlyMessage = err.code ? getFirebaseErrorMessage(err) : err.message;
            throw new Error(friendlyMessage);
        }
    }, []);

    // ── Sync with backend (can be called manually) ──
    const syncWithBackend = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!token) return null;
        try {
            const data = await apiRequest('GET', '/auth/me', null, token);
            if (data.success) {
                setUser(data.user);
                setCommittees(data.committees || []);
                return data;
            }
        } catch (err) {
            console.error('Backend sync failed:', err);
        }
        return null;
    }, [apiRequest]);

    const value = {
        user,
        firebaseUser,
        committees,
        loading,
        isAuthenticated,
        error,
        login,
        register,
        logout,
        resetPassword,
        syncWithBackend,
        // Aliases for compatibility
        currentUser: user,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
