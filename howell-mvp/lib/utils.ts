import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return `₹${amount} LPA`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export const STATUS_LABELS: Record<string, string> = {
  applied:              'Applied',
  screening:            'Screening',
  shortlisted:          'Shortlisted',
  interview_scheduled:  'Interview Scheduled',
  interview_done:       'Interviewed',
  offer:                'Offer Extended',
  hired:                'Hired',
  rejected:             'Rejected',
  withdrawn:            'Withdrawn',
}

export const STATUS_COLORS: Record<string, string> = {
  applied:              'bg-gray-100 text-gray-700',
  screening:            'bg-blue-100 text-blue-700',
  shortlisted:          'bg-purple-100 text-purple-700',
  interview_scheduled:  'bg-amber-100 text-amber-700',
  interview_done:       'bg-pink-100 text-pink-700',
  offer:                'bg-emerald-100 text-emerald-700',
  hired:                'bg-green-100 text-green-700',
  rejected:             'bg-red-100 text-red-700',
  withdrawn:            'bg-gray-100 text-gray-500',
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  active:    'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  closed:    'bg-red-100 text-red-600',
}

export const PIPELINE_STAGES = [
  'applied', 'screening', 'shortlisted', 'interview_scheduled',
  'interview_done', 'offer', 'hired',
]
