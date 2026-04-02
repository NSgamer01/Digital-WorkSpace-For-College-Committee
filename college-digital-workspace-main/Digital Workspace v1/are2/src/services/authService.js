// ============================================
// services/authService.js — Firebase Auth Service
// ============================================
// Firebase handles ONLY authentication.
// After signup, the backend creates the PostgreSQL user record.
// NO Firestore user documents are created here.
// ============================================

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../firebase/config';

/**
 * Register a new user with Firebase Auth.
 * - Trims and lowercases email before sending to Firebase
 * - Sets displayName via updateProfile
 * - Does NOT create any Firestore documents
 * - Backend sync (PostgreSQL) happens in AuthContext
 */
export const registerUser = async (email, password, name) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name || '').trim() || cleanEmail.split('@')[0];

    console.log('📧 Firebase registerUser:', {
        email: cleanEmail,
        emailLength: cleanEmail.length,
        nameLength: cleanName.length,
        passwordLength: password.length,
        hasWhitespace: email !== email.trim(),
    });

    // Create Firebase auth account
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const user = userCredential.user;

    // Set display name on Firebase profile
    await updateProfile(user, { displayName: cleanName });

    console.log('✅ Firebase user created:', user.uid);

    return user;
};

/**
 * Login with Firebase Auth.
 * - Trims and lowercases email
 * - Backend sync happens in AuthContext
 */
export const loginUser = async (email, password) => {
    const cleanEmail = email.trim().toLowerCase();
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return userCredential.user;
};

/**
 * Logout from Firebase Auth.
 */
export const logoutUser = async () => {
    await signOut(auth);
};

/**
 * Subscribe to Firebase auth state changes.
 * Returns the unsubscribe function.
 */
export const subscribeToAuthChanges = (callback) => {
    return onAuthStateChanged(auth, callback);
};

/**
 * Get Firebase ID token for the current user.
 */
export const getIdToken = async () => {
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
};

/**
 * Send password reset email.
 */
export const resetPassword = async (email) => {
    const cleanEmail = email.trim().toLowerCase();
    await sendPasswordResetEmail(auth, cleanEmail);
};
