// ============================================
// src/App.jsx
// ============================================
// Updated with AuthProvider, ThemeProvider, SettingsProvider,
// CommitteeProvider, RequireCommittee guard, ProtectedRoute,
// PublicOnlyRoute, and all page components.
// NOTE: BrowserRouter is in main.jsx, NOT here.
// ============================================

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CommitteeProvider, useCommittee } from './contexts/CommitteeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { PublicOnlyRoute } from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import CommitteeSelector from './components/CommitteeSelector';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Calendar from './pages/Calendar';
import Messages from './pages/Messages';
import Drive from './pages/Drive';
import Members from './pages/Members';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';

// Layout (existing Sidebar + Topbar)
import Layout from './components/Layout';



// Presence hook
import usePresence from './hooks/usePresence';

// ── RequireAuth — redirects to login if not authenticated ──
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bgPrimary, #09090b)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #27272a', borderTopColor: '#3b82f6',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ── RequireCommittee — redirects to /select-committee if no committee selected ──
function RequireCommittee({ children }) {
  const { currentCommittee, loading } = useCommittee();

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bgPrimary, #09090b)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #27272a', borderTopColor: '#3b82f6',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Loading committees...</p>
        </div>
      </div>
    );
  }

  if (!currentCommittee) {
    return <Navigate to="/select-committee" replace />;
  }

  return children;
}

// ── ProtectedRoute — requires both auth + committee ──
function ProtectedRoute({ children }) {
  return (
    <RequireAuth>
      <RequireCommittee>
        <Layout>
          {children}
        </Layout>
      </RequireCommittee>
    </RequireAuth>
  );
}

// ── PresenceTracker — tracks current user's presence ──
function PresenceTracker() {
  const { user } = useAuth();
  usePresence(user?.id || user?.userId);
  return null; // side-effect only, no UI
}

// ── App ──
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CommitteeProvider>
          <SettingsProvider>
            <NotificationProvider>
              {/* Track presence whenever authenticated */}
              <PresenceTrackerWrapper />



              <Routes>
                {/* Public routes (redirect to dashboard if already logged in) */}
                <Route path="/" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />

                {/* Committee selection (requires auth but not committee) */}
                <Route path="/select-committee" element={
                  <RequireAuth>
                    <CommitteeSelector />
                  </RequireAuth>
                } />

                {/* Settings — requires auth + committee */}
                <Route path="/settings" element={
                  <RequireAuth>
                    <RequireCommittee>
                      <Layout>
                        <Settings />
                      </Layout>
                    </RequireCommittee>
                  </RequireAuth>
                } />

                {/* Protected routes (require auth + committee) */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                <Route path="/tasks/:taskId" element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} />
                <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/drive" element={<ProtectedRoute><Drive /></ProtectedRoute>} />
                <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
                <Route path="/announcements" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </NotificationProvider>
          </SettingsProvider>
        </CommitteeProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

// Wrapper to ensure PresenceTracker only renders when auth is available
function PresenceTrackerWrapper() {
  try {
    return <PresenceTracker />;
  } catch {
    return null;
  }
}

export default App;
