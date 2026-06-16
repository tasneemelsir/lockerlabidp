import { formatDistanceToNow, format, differenceInDays, addDays } from 'date-fns'

export const formatDate = (date) => format(new Date(date), 'dd MMM yyyy')
export const formatDateTime = (date) => format(new Date(date), 'dd MMM yyyy, h:mm a')
export const getDaysLeft = (dueDate) => differenceInDays(new Date(dueDate), new Date())
export const getRelativeTime = (date) => formatDistanceToNow(new Date(date), { addSuffix: true })
export const getBorrowDeadline = (borrowedAt) => addDays(new Date(borrowedAt), 7)
export const isOverdue = (dueDate) => new Date() > new Date(dueDate)
export const isNearingDeadline = (dueDate) => getDaysLeft(dueDate) <= 2 && !isOverdue(dueDate)
