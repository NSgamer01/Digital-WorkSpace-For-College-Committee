// ============================================
// src/components/FirebaseDebug.jsx — Dev-Only Debug Panel
// ============================================
// Shows Firebase status, env vars, auth state, and backend connectivity.
// Only renders in development (import.meta.env.DEV).
// Remove or disable before production deployment.
// ============================================

import React, { useState, useEffect } from 'react';
import { getApps } from 'firebase/app';
import { auth } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function FirebaseDebug() {
    const [isOpen, setIsOpen] = useState(false);
    const [healthStatus, setHealthStatus] = useState(null);
    const [healthLoading, setHealthLoading] = useState(false);
    const { user, firebaseUser, isAuthenticated, register, login, logout } = useAuth();

    // Test state
    const [testEmail, setTestEmail] = useState('test@example.com');
    const [testPassword, setTestPassword] = useState('testpass123');
    const [testName, setTestName] = useState('Test User');
    const [testResult, setTestResult] = useState('');
    const [lastError, setLastError] = useState('(none)');

    // Only render in development and for admin users
    if (!import.meta.env.DEV) return null;
    if (user?.globalRole !== 'admin') return null;

    // Check env vars
    const envVars = {
        'API Key': import.meta.env.VITE_FIREBASE_API_KEY,
        'Auth Domain': import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        'Project ID': import.meta.env.VITE_FIREBASE_PROJECT_ID,
        'Storage Bucket': import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        'Messaging Sender': import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        'App ID': import.meta.env.VITE_FIREBASE_APP_ID,
    };

    const truncate = (val) => {
        if (!val) return null;
        return val.length > 12 ? val.substring(0, 12) + '...' : val;
    };

    const checkHealth = async () => {
        setHealthLoading(true);
        try {
            // Try the base URL without /api suffix
            const baseUrl = API_BASE.replace(/\/api$/, '');
            const res = await fetch(`${baseUrl}/api/health`);
            const data = await res.json();
            setHealthStatus(data);
        } catch (err) {
            setHealthStatus({ error: err.message });
        }
        setHealthLoading(false);
    };

    const handleTestSignup = async () => {
        setTestResult('Testing signup...');
        setLastError('(none)');
        try {
            const data = await register(testEmail, testPassword, testName);
            setTestResult(`✅ Signup success: ${JSON.stringify(data?.user?.email || data)}`);
        } catch (err) {
            setLastError(`${err.code || ''}: ${err.message}`);
            setTestResult(`❌ Signup failed: ${err.message}`);
        }
    };

    const handleTestLogin = async () => {
        setTestResult('Testing login...');
        setLastError('(none)');
        try {
            const data = await login(testEmail, testPassword);
            setTestResult(`✅ Login success: ${JSON.stringify(data?.user?.email || data)}`);
        } catch (err) {
            setLastError(`${err.code || ''}: ${err.message}`);
            setTestResult(`❌ Login failed: ${err.message}`);
        }
    };

    const handleClearStorage = async () => {
        try {
            await logout();
            localStorage.clear();
            setTestResult('✅ Storage cleared & signed out');
        } catch (err) {
            setTestResult(`❌ Clear failed: ${err.message}`);
        }
    };

    const statusIcon = (ok) => ok ? '✅' : '❌';
    const warnIcon = (ok) => ok ? '✅' : '⚠️';

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            fontFamily: "'Monaco', 'Menlo', 'Courier New', monospace",
            fontSize: '12px',
        }}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'absolute',
                    bottom: isOpen ? undefined : 0,
                    top: isOpen ? 0 : undefined,
                    right: 16,
                    padding: '6px 14px',
                    background: '#1e1e2e',
                    color: '#89b4fa',
                    border: '1px solid #313244',
                    borderBottom: isOpen ? '1px solid #313244' : 'none',
                    borderRadius: isOpen ? '8px 8px 0 0' : '8px 8px 0 0',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    zIndex: 10000,
                }}
            >
                🔧 Firebase Debug {isOpen ? '▼' : '▲'}
            </button>

            {/* Panel */}
            {isOpen && (
                <div style={{
                    background: '#1e1e2e',
                    border: '1px solid #313244',
                    borderBottom: 'none',
                    color: '#cdd6f4',
                    padding: '16px 20px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                }}>
                    {/* Left Column */}
                    <div>
                        {/* Firebase Status */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: '#89b4fa' }}>Firebase Status</div>
                            <div>App initialized: {statusIcon(getApps().length > 0)} {getApps().length > 0 ? 'Yes' : 'No'}</div>
                            <div>Auth instance: {statusIcon(!!auth)} {auth ? 'Exists' : 'Missing'}</div>
                            <div>Project ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID || '❌ Not set'}</div>
                        </div>

                        {/* Environment Variables */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: '#89b4fa' }}>Environment Variables</div>
                            {Object.entries(envVars).map(([label, val]) => (
                                <div key={label}>
                                    {label}: {warnIcon(!!val)} {val ? `Present (${truncate(val)})` : 'MISSING'}
                                </div>
                            ))}
                        </div>

                        {/* Auth State */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: '#89b4fa' }}>Current Auth State</div>
                            <div>Firebase User: {statusIcon(!!auth.currentUser)} {auth.currentUser ? auth.currentUser.email : 'Not signed in'}</div>
                            <div>PostgreSQL User: {statusIcon(!!user)} {user ? `${user.name} (${user.email})` : 'Not loaded'}</div>
                            <div>isAuthenticated: {statusIcon(isAuthenticated)} {String(isAuthenticated)}</div>
                            <div>Token in Storage: {statusIcon(!!localStorage.getItem('token'))} {localStorage.getItem('token') ? 'Present' : 'Not found'}</div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div>
                        {/* Backend Connection */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: '#89b4fa' }}>Backend Connection</div>
                            <div>
                                API URL: {API_BASE}
                                <button
                                    onClick={checkHealth}
                                    style={{
                                        marginLeft: 8, padding: '2px 8px', background: '#313244',
                                        color: '#89b4fa', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                                    }}
                                >
                                    {healthLoading ? '...' : 'Test'}
                                </button>
                            </div>
                            {healthStatus && (
                                <div style={{ marginTop: 4, color: healthStatus.error ? '#f38ba8' : '#a6e3a1' }}>
                                    {healthStatus.error
                                        ? `❌ ${healthStatus.error}`
                                        : `✅ Connected — ${JSON.stringify(healthStatus).substring(0, 80)}`}
                                </div>
                            )}
                        </div>

                        {/* Test Actions */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, color: '#89b4fa' }}>Test Auth</div>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                <input
                                    value={testEmail}
                                    onChange={e => setTestEmail(e.target.value)}
                                    placeholder="Email"
                                    style={{ flex: 1, padding: '4px 8px', background: '#313244', color: '#cdd6f4', border: '1px solid #45475a', borderRadius: 4, fontSize: 11 }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                                <input
                                    value={testPassword}
                                    onChange={e => setTestPassword(e.target.value)}
                                    placeholder="Password"
                                    style={{ flex: 1, padding: '4px 8px', background: '#313244', color: '#cdd6f4', border: '1px solid #45475a', borderRadius: 4, fontSize: 11 }}
                                />
                                <input
                                    value={testName}
                                    onChange={e => setTestName(e.target.value)}
                                    placeholder="Name"
                                    style={{ flex: 1, padding: '4px 8px', background: '#313244', color: '#cdd6f4', border: '1px solid #45475a', borderRadius: 4, fontSize: 11 }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={handleTestSignup} style={{ padding: '4px 10px', background: '#313244', color: '#a6e3a1', border: '1px solid #45475a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                                    Test Signup
                                </button>
                                <button onClick={handleTestLogin} style={{ padding: '4px 10px', background: '#313244', color: '#89b4fa', border: '1px solid #45475a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                                    Test Login
                                </button>
                                <button onClick={handleClearStorage} style={{ padding: '4px 10px', background: '#313244', color: '#f38ba8', border: '1px solid #45475a', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                                    Clear Storage
                                </button>
                            </div>
                        </div>

                        {/* Results */}
                        {testResult && (
                            <div style={{ marginBottom: 8, padding: '6px 8px', background: '#11111b', borderRadius: 4, wordBreak: 'break-all' }}>
                                {testResult}
                            </div>
                        )}
                        <div style={{ color: '#6c7086' }}>
                            Last Error: {lastError}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FirebaseDebug;
