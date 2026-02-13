import React from 'react'
import { Lock, Unlock } from 'lucide-react'
import { Requirement } from 'shared/types/engineering.types'
import { clsx } from 'clsx' // Assuming clsx is used

interface LockButtonProps {
    requirement: Requirement
    currentUserId: string | undefined
    onLock: () => void
    onUnlock: () => void
    isLoading?: boolean
}

export const LockButton: React.FC<LockButtonProps> = ({
    requirement,
    currentUserId,
    onLock,
    onUnlock,
    isLoading = false,
}) => {
    const isLocked = requirement.isLocked
    const isLockedByCurrentUser = requirement.lockedByUserId === currentUserId

    // If not locked, show lock button (enabled)
    if (!isLocked) {
        return (
            <button
                onClick={onLock}
                disabled={isLoading}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Lock requirement"
            >
                <Unlock size={20} />
            </button>
        )
    }

    // If locked by current user, show unlock button (enabled)
    if (isLockedByCurrentUser) {
        return (
            <button
                onClick={onUnlock}
                disabled={isLoading}
                className="p-2 text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                title="Locked by you. Click to unlock."
            >
                <Lock size={20} />
            </button>
        )
    }

    // If locked by someone else, show lock icon (disabled/read-only indicator)
    return (
        <div
            className="p-2 text-red-500 dark:text-red-400 cursor-help"
            title={`Locked by ${requirement.lockedByUserId || 'another user'} on ${requirement.lockedAt ? new Date(requirement.lockedAt).toLocaleString() : 'unknown date'}`}
        >
            <Lock size={20} />
        </div>
    )
}
