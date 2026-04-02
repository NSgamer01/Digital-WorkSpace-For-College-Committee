// ============================================
// src/constants/roles.js — College Workspace Roles
// ============================================
// Centralized role definitions for the college workspace.
// All role checks should import from this file.
// Includes: role constants, labels, colors, hierarchy,
// permissions, and helper functions.
// ============================================

export const ROLES = {
    ADMIN: 'admin',
    HEAD: 'head',
    FACULTY: 'faculty',
    COORDINATOR: 'coordinator',
    SECRETARY: 'secretary',
    TREASURER: 'treasurer',
    VOLUNTEER: 'volunteer',
    MEMBER: 'member',
};

export const ROLE_LABELS = {
    [ROLES.ADMIN]: 'Admin',
    [ROLES.HEAD]: 'Head',
    [ROLES.FACULTY]: 'Faculty',
    [ROLES.COORDINATOR]: 'Coordinator',
    [ROLES.SECRETARY]: 'Secretary',
    [ROLES.TREASURER]: 'Treasurer',
    [ROLES.VOLUNTEER]: 'Volunteer',
    [ROLES.MEMBER]: 'Member',
};

export const ROLE_COLORS = {
    [ROLES.ADMIN]: '#ef4444',
    [ROLES.HEAD]: '#8b5cf6',
    [ROLES.FACULTY]: '#3b82f6',
    [ROLES.COORDINATOR]: '#06b6d4',
    [ROLES.SECRETARY]: '#f59e0b',
    [ROLES.TREASURER]: '#10b981',
    [ROLES.VOLUNTEER]: '#6366f1',
    [ROLES.MEMBER]: '#64748b',
};

// Ordered from highest to lowest authority
export const ROLE_HIERARCHY = [
    'head',
    'faculty',
    'admin',
    'coordinator',
    'secretary',
    'treasurer',
    'volunteer',
    'member',
];

export const ROLE_PERMISSIONS = {
    [ROLES.HEAD]: {
        canManageMembers: true,
        canAssignRoles: true,
        canCreateAnnouncements: true,
        canCreateTasks: true,
        canCreateEvents: true,
        canDeleteAnyContent: true,
        canManageFiles: true,
        canEditCommitteeSettings: true,
    },
    [ROLES.FACULTY]: {
        canManageMembers: true,
        canAssignRoles: true,
        canCreateAnnouncements: true,
        canCreateTasks: true,
        canCreateEvents: true,
        canDeleteAnyContent: true,
        canManageFiles: true,
        canEditCommitteeSettings: false,
    },
    [ROLES.ADMIN]: {
        canManageMembers: true,
        canAssignRoles: true,
        canCreateAnnouncements: true,
        canCreateTasks: true,
        canCreateEvents: true,
        canDeleteAnyContent: true,
        canManageFiles: true,
        canEditCommitteeSettings: false,
    },
    [ROLES.COORDINATOR]: {
        canManageMembers: false,
        canAssignRoles: false,
        canCreateAnnouncements: true,
        canCreateTasks: true,
        canCreateEvents: true,
        canDeleteAnyContent: false,
        canManageFiles: true,
        canEditCommitteeSettings: false,
    },
    [ROLES.SECRETARY]: {
        canManageMembers: false,
        canAssignRoles: false,
        canCreateAnnouncements: true,
        canCreateTasks: true,
        canCreateEvents: false,
        canDeleteAnyContent: false,
        canManageFiles: false,
        canEditCommitteeSettings: false,
    },
    [ROLES.TREASURER]: {
        canManageMembers: false,
        canAssignRoles: false,
        canCreateAnnouncements: true,
        canCreateTasks: true,
        canCreateEvents: false,
        canDeleteAnyContent: false,
        canManageFiles: false,
        canEditCommitteeSettings: false,
    },
    [ROLES.VOLUNTEER]: {
        canManageMembers: false,
        canAssignRoles: false,
        canCreateAnnouncements: false,
        canCreateTasks: true,
        canCreateEvents: false,
        canDeleteAnyContent: false,
        canManageFiles: false,
        canEditCommitteeSettings: false,
    },
    [ROLES.MEMBER]: {
        canManageMembers: false,
        canAssignRoles: false,
        canCreateAnnouncements: false,
        canCreateTasks: false,
        canCreateEvents: false,
        canDeleteAnyContent: false,
        canManageFiles: false,
        canEditCommitteeSettings: false,
    },
};

/**
 * Check if a user role has a specific permission.
 * @param {string} userRole - The user's committee role (e.g., 'admin', 'coordinator')
 * @param {string} permission - The permission key (e.g., 'canCreateTasks')
 * @returns {boolean}
 */
export const hasPermission = (userRole, permission) => {
    const rolePerms = ROLE_PERMISSIONS[userRole];
    if (!rolePerms) return false;
    return rolePerms[permission] === true;
};

/**
 * Check if a user can perform a named action.
 * Maps action names to permission keys for convenience.
 * @param {string} committeeRole - The user's committee role
 * @param {string} action - The action name (e.g., 'manageMembers', 'createTasks')
 * @returns {boolean}
 */
export const canUserPerformAction = (committeeRole, action) => {
    const actionMap = {
        manageMembers: 'canManageMembers',
        assignRoles: 'canAssignRoles',
        createAnnouncements: 'canCreateAnnouncements',
        createTasks: 'canCreateTasks',
        createEvents: 'canCreateEvents',
        deleteAnyContent: 'canDeleteAnyContent',
        manageFiles: 'canManageFiles',
        editCommitteeSettings: 'canEditCommitteeSettings',
    };

    const permissionKey = actionMap[action] || action;
    return hasPermission(committeeRole, permissionKey);
};
