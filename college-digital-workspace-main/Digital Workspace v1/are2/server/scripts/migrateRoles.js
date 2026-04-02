// ============================================
// src/utils/migrateRoles.js — Role Migration Utility
// ============================================
// Maps old generic roles to new college-specific roles.
// Run this once to update all user documents in Firestore.
// ============================================

import { collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const ROLE_MAP = {
    'admin': 'admin',
    'moderator': 'head',
    'user': 'member',
};

/**
 * Migrate all user documents from old roles to new college-specific roles.
 * Maps: admin → admin, moderator → head, user → member, default → member.
 * Logs progress to console.
 */
export const migrateUserRoles = async () => {
    console.log('🔄 Starting role migration...');

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const total = usersSnapshot.size;
        let updated = 0;
        let skipped = 0;

        for (const userDoc of usersSnapshot.docs) {
            const data = userDoc.data();
            const oldRole = data.role || '';
            const newRole = ROLE_MAP[oldRole] || 'member';

            if (oldRole === newRole) {
                skipped++;
                console.log(`⏭️ [${updated + skipped}/${total}] ${data.displayName || userDoc.id} — already "${newRole}"`);
                continue;
            }

            await updateDoc(doc(db, 'users', userDoc.id), {
                role: newRole,
                updatedAt: serverTimestamp(),
            });

            updated++;
            console.log(`✅ [${updated + skipped}/${total}] ${data.displayName || userDoc.id}: "${oldRole}" → "${newRole}"`);
        }

        console.log(`\n🎉 Migration complete! Updated: ${updated}, Skipped: ${skipped}, Total: ${total}`);
        return { updated, skipped, total };
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};
