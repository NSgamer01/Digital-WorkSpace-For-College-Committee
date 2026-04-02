// ============================================
// src/pages/Login.jsx — Standalone Login Page
// ============================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Reset password modal state
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState('');

    const navigate = useNavigate();
    const { login, resetPassword } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password) {
            setError('Please enter your email and password.');
            return;
        }

        setLoading(true);
        try {
            const data = await login(email, password);

            if (data.committees && data.committees.length > 0) {
                if (data.lastCommitteeSlug) {
                    localStorage.setItem('currentCommitteeSlug', data.lastCommitteeSlug);
                    navigate('/dashboard');
                } else {
                    navigate('/select-committee');
                }
            } else {
                navigate('/select-committee');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetSent(false);

        if (!resetEmail.trim()) {
            setResetError('Please enter your email address.');
            return;
        }

        try {
            await resetPassword(resetEmail);
            setResetSent(true);
        } catch (err) {
            setResetError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-gray-900 to-zinc-950 flex items-center justify-center px-4">
            <div className="w-full max-w-[440px] bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 p-10">

                {/* Top Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="text-3xl">🎓</span>
                    </div>
                </div>

                {/* Title */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white mb-1">Digital Workspace</h1>
                    <p className="text-zinc-400 text-sm">Sign in to your account</p>
                </div>

                <form onSubmit={handleSubmit}>

                    {/* Email */}
                    <div className="mb-4">
                        <label className="block text-zinc-400 text-sm font-medium mb-2">Email</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">📧</span>
                            <input
                                type="email"
                                id="login-email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="mb-4">
                        <label className="block text-zinc-400 text-sm font-medium mb-2">Password</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔒</span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="login-password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {/* Forgot Password */}
                    <div className="mb-5 text-right">
                        <span
                            onClick={() => { setShowResetModal(true); setResetEmail(email); }}
                            className="text-blue-400 hover:text-blue-300 cursor-pointer text-xs font-medium transition-colors hover:underline"
                        >
                            Forgot password?
                        </span>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-red-400 text-sm flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </p>
                        </div>
                    )}

                    {/* Sign In Button */}
                    <button
                        type="submit"
                        id="login-submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 mb-6 transition-all duration-200 ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-110 hover:shadow-xl hover:shadow-blue-600/30'}`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Signing in...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form>

                {/* Bottom */}
                <p className="text-center text-zinc-500 text-sm">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium transition-colors hover:underline">
                        Sign up
                    </Link>
                </p>
            </div>

            {/* Reset Password Modal */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl w-full max-w-[400px] relative shadow-2xl shadow-black/50">
                        <button
                            onClick={() => { setShowResetModal(false); setResetSent(false); setResetError(''); }}
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                        >
                            ✕
                        </button>

                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white">Reset Password</h2>
                            <p className="text-zinc-500 text-sm mt-1">Enter your email to receive a reset link</p>
                        </div>

                        {resetSent ? (
                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                <p className="text-green-400 text-sm flex items-center gap-2">
                                    <span>✅</span> Password reset email sent! Check your inbox.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    className="w-full bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                />
                                {resetError && <p className="text-red-400 text-sm">⚠️ {resetError}</p>}
                                <button
                                    type="submit"
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 hover:brightness-110 transition-all duration-200"
                                >
                                    Send Reset Link
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
