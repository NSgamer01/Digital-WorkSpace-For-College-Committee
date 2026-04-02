// ── Static dummy users ──────────────────────────────────────────
// Used by UserList and GeneralChannel for the direct messages view.
// Will be replaced with Firestore queries later.

export const mockUsers = [
    { id: 1, name: 'Arjun Sharma', role: 'Head', initial: 'A' },
    { id: 2, name: 'Priya Patel', role: 'Member', initial: 'P' },
    { id: 3, name: 'Rahul Verma', role: 'Member', initial: 'R' },
    { id: 4, name: 'Dr. Meera Kapoor', role: 'Teacher', initial: 'M' },
    { id: 5, name: 'Sneha Gupta', role: 'Member', initial: 'S' },
];

// ── Role badge classes ──────────────────────────────────────────
export const roleBadgeClasses = {
    Teacher: 'bg-amber-500/10 text-amber-400',
    Head: 'bg-purple-500/10 text-purple-400',
    Admin: 'bg-purple-500/10 text-purple-400',
    Member: 'bg-blue-500/10 text-blue-400',
};

// ── Avatar gradient palette ─────────────────────────────────────
export const avatarGradients = [
    'from-blue-500 to-cyan-400',
    'from-purple-500 to-pink-400',
    'from-emerald-500 to-teal-400',
    'from-orange-500 to-yellow-400',
    'from-indigo-500 to-violet-400',
];
