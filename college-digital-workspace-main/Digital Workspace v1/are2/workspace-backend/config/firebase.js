// ============================================
// config/firebase.js — Firebase Admin SDK
// ============================================
// Initializes firebase-admin for server-side token verification.
// Supports both service account JSON file and env-based config.
// ============================================

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to load service account from file first
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log('  🔑  Firebase Admin initialized with service account file');
} else if (process.env.FIREBASE_PROJECT_ID) {
    // Fallback: use environment variables
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Replace escaped newlines in the private key
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
    });
    console.log('  🔑  Firebase Admin initialized with environment variables');
} else {
    // No credentials — initialize without credential (limited functionality)
    console.warn('  ⚠️   No Firebase credentials found!');
    console.warn('       Place firebase-service-account.json in workspace-backend/config/');
    console.warn('       Or set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars');
    admin.initializeApp();
}

module.exports = admin;
