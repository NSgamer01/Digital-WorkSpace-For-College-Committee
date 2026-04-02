// ============================================
// src/pages/Signup.jsx — Standalone Signup Page
// ============================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Signup = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const navigate = useNavigate();
    const { register } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!name.trim()) {
            setError('Please enter your name.');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError('Please enter a valid email address.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            console.log('📧 Signup attempt:', {
                email: email.trim().toLowerCase(),
                emailLength: email.trim().length,
                nameLength: name.trim().length,
                passwordLength: password.length,
                hasWhitespace: email !== email.trim(),
            });

            const data = await register(email, password, name);
            console.log('✅ Account created:', data?.user?.email);
            navigate('/select-committee');
        } catch (err) {
            console.error('❌ Signup failed:', {
                code: err.code,
                message: err.message,
                email: email.trim().toLowerCase(),
            });
            setError(err.message);
        } finally {
            setLoading(false);
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
                    <p className="text-zinc-400 text-sm">Create your account</p>
                </div>

                <form onSubmit={handleSubmit}>

                    {/* Full Name */}
                    <div className="mb-4">
                        <label className="block text-zinc-400 text-sm font-medium mb-2">Full Name</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">👤</span>
                            <input
                                type="text"
                                id="signup-name"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                autoComplete="name"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="mb-4">
                        <label className="block text-zinc-400 text-sm font-medium mb-2">Email Address</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">📧</span>
                            <input
                                type="email"
                                id="signup-email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="mb-1">
                        <label className="block text-zinc-400 text-sm font-medium mb-2">Password</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔒</span>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="signup-password"
                                placeholder="Minimum 6 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <p className="text-zinc-600 text-xs mt-1 ml-1">Password must be at least 6 characters</p>
                    </div>

                    {/* Confirm Password */}
                    <div className="mb-5">
                        <label className="block text-zinc-400 text-sm font-medium mb-2">Confirm Password</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔒</span>
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                id="signup-confirm-password"
                                placeholder="Re-enter your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-zinc-800/60 border border-zinc-700 text-white placeholder-zinc-500 rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                            >
                                {showConfirmPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-red-400 text-sm flex items-center gap-2">
                                <span>⚠️</span> {error}
                            </p>
                        </div>
                    )}

                    {/* Create Account Button */}
                    <button
                        type="submit"
                        id="signup-submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 mb-6 transition-all duration-200 ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-110 hover:shadow-xl hover:shadow-blue-600/30'}`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creating account...
                            </span>
                        ) : 'Create Account'}
                    </button>
                </form>

                {/* Bottom */}
                <p className="text-center text-zinc-500 text-sm">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
