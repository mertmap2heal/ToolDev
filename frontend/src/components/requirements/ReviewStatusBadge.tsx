import React from 'react'
import { CheckCircle2, XCircle, Clock, FileText } from 'lucide-react'
import clsx from 'clsx'
import type { ReviewStatus, ReviewerStatus } from 'shared/types/engineering.types'

interface ReviewStatusBadgeProps {
  status: ReviewStatus | ReviewerStatus | 'draft' | 'under_review' | 'approved' | 'rejected'
  size?: 'sm' | 'md' | 'lg'
}

export default function ReviewStatusBadge({ status, size = 'md' }: ReviewStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'draft':
        return {
          icon: FileText,
          label: 'Draft',
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        }
      case 'under_review':
      case 'in_review':
      case 'pending':
      case 'in_progress':
        return {
          icon: Clock,
          label: 'Under Review',
          className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        }
      case 'deferred':
        return {
          icon: Clock,
          label: 'Deferred',
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        }
      case 'approved':
        return {
          icon: CheckCircle2,
          label: 'Approved',
          className: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        }
      case 'rejected':
        return {
          icon: XCircle,
          label: 'Rejected',
          className: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        }
      case 'cancelled':
        return {
          icon: XCircle,
          label: 'Cancelled',
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        }
      default:
        return {
          icon: FileText,
          label: status,
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.className,
        sizeClasses[size]
      )}
    >
      <Icon size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
      {config.label}
    </span>
  )
}
