// ============================================
// src/contexts/CommitteeContext.jsx
// ============================================
// React context for managing committee selection.
// Provides committee list, current committee,
// switch functionality, and localStorage persistence.
// ============================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const CommitteeContext = createContext(null);

export function CommitteeProvider({ children }) {
    const [committees, setCommittees] = useState([]);
    const [currentCommittee, setCurrentCommittee] = useState(null);
    const [committeeRole, setCommitteeRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const { isAuthenticated } = useAuth();

    // Load committees — only when authenticated
    const loadCommittees = useCallback(async () => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);

            const response = await api.get('/api/committees/mine');

            if (response.success) {
                const committeeList = response.committees || [];
                setCommittees(committeeList);

                // Auto-select: saved slug from localStorage, or lastCommitteeSlug from server
                const savedSlug = localStorage.getItem('currentCommitteeSlug');
                const lastSlug = response.lastCommitteeSlug;
                const targetSlug = savedSlug || lastSlug;

                if (targetSlug) {
                    const found = committeeList.find(c => c.slug === targetSlug);
                    if (found) {
                        setCurrentCommittee(found);
                        setCommitteeRole(found.role);
                        localStorage.setItem('currentCommitteeSlug', found.slug);
                        localStorage.setItem('currentCommitteeName', found.name);
                        localStorage.setItem('currentCommitteeColor', found.color);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load committees:', err);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        loadCommittees();
    }, [loadCommittees]);

    // Switch committee
    const switchCommittee = useCallback(async (committee) => {
        try {
            const response = await api.post('/api/committees/switch', {
                slug: committee.slug,
            });

            if (response.success) {
                setCurrentCommittee(committee);
                setCommitteeRole(response.role || committee.role);
                localStorage.setItem('currentCommitteeSlug', committee.slug);
                localStorage.setItem('currentCommitteeName', committee.name);
                localStorage.setItem('currentCommitteeColor', committee.color);
                return true;
            }
            return false;
        } catch (err) {
            console.error('Failed to switch committee:', err);
            return false;
        }
    }, []);

    // Clear committee (for logout)
    const clearCommittee = useCallback(() => {
        setCurrentCommittee(null);
        setCommitteeRole(null);
        setCommittees([]);
        localStorage.removeItem('currentCommitteeSlug');
        localStorage.removeItem('currentCommitteeName');
        localStorage.removeItem('currentCommitteeColor');
    }, []);

    // Computed values
    const needsSelection = committees.length > 0 && !currentCommittee;
    const hasNoCommittees = !loading && committees.length === 0;

    const value = {
        committees,
        currentCommittee,
        committeeRole,
        loading,
        loadCommittees,
        switchCommittee,
        clearCommittee,
        needsSelection,
        hasNoCommittees,
    };

    return (
        <CommitteeContext.Provider value={value}>
            {children}
        </CommitteeContext.Provider>
    );
}

export function useCommittee() {
    const context = useContext(CommitteeContext);
    if (!context) {
        throw new Error('useCommittee must be used within a CommitteeProvider');
    }
    return context;
}

export default CommitteeContext;
