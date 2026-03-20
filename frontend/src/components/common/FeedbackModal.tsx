import React, { useState, useRef } from 'react'
import { X, Upload, Send, Loader2, CheckCircle, AlertCircle, File as FileIcon, Trash2 } from 'lucide-react'
import { feedbackService } from '../../services/feedback.service'
import clsx from 'clsx'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface FeedbackModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
    const onDiscardRef = useRef<() => void>()
    const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
    const [message, setMessage] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    onDiscardRef.current = () => {
        setMessage('')
        setFile(null)
    }

    if (!isOpen) return null

    const handleClose = () => {
        if (loading) return
        guardClose()
        // Reset state after transition
        setTimeout(() => {
            setMessage('')
            setFile(null)
            setStatus('idle')
            setErrorMessage('')
        }, 300)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0])
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!message.trim()) return

        setLoading(true)
        setStatus('idle')

        try {
            let fileData: string | undefined
            let fileName: string | undefined

            if (file) {
                fileName = file.name
                fileData = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.readAsDataURL(file)
                    reader.onload = () => resolve(reader.result as string)
                    reader.onerror = error => reject(error)
                })
            }

            await feedbackService.sendFeedback({
                message,
                fileData,
                fileName,
            })

            resetDirty()
            setStatus('success')
            setTimeout(() => {
                handleClose()
            }, 2000)
        } catch (error) {
            console.error('Feedback error:', error)
            setStatus('error')
            setErrorMessage(error instanceof Error ? error.message : 'Failed to send feedback. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            aria-labelledby="feedback-modal-title"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
                onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
                aria-hidden="true"
            />

            {/* Modal Panel */}
            <div className="relative w-full max-w-lg transform overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl transition-all border border-gray-200 dark:border-gray-700">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
                    <h2 id="feedback-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        Send Feedback
                    </h2>
                    <div className="flex items-center gap-2">
                        {draftBanner}
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <span className="sr-only">Close</span>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6">
                    {status === 'success' ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                                <CheckCircle size={32} />
                            </div>
                            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Thank you!</h3>
                            <p className="text-gray-500 dark:text-gray-400">Your feedback has been sent successfully.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Message Input */}
                            <div>
                                <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    How can we improve? <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    id="feedback-message"
                                    required
                                    rows={4}
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700/50 dark:text-white sm:text-sm p-3 resize-none transition-shadow"
                                    placeholder="Tell us what you like, what's not working, or what features you'd like to see..."
                                    value={message}
                                    onChange={(e) => { setMessage(e.target.value); markDirty() }}
                                />
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Screenshot or Document (Optional)
                                </label>

                                {!file ? (
                                    <div
                                        className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer group bg-gray-50 dark:bg-gray-800/50"
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <div className="space-y-1 text-center">
                                            <div className="mx-auto h-10 w-10 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors rounded-full bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm">
                                                <Upload size={20} />
                                            </div>
                                            <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                                                <label className="relative cursor-pointer rounded-md font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 focus-within:outline-none">
                                                    <span>Upload a file</span>
                                                </label>
                                                <p className="pl-1">or drag and drop</p>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                                PNG, JPG, PDF up to 10MB
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-1 flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 bg-white dark:bg-gray-600 rounded-md shadow-sm text-blue-600 dark:text-blue-400">
                                                <FileIcon size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                                                    {file.name}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {(file.size / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFile(null)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-white dark:hover:bg-gray-600"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                />
                            </div>

                            {/* Error Message */}
                            {status === 'error' && (
                                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                                {errorMessage}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !message.trim()}
                                    className={clsx(
                                        "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-sm",
                                        (loading || !message.trim()) && "opacity-60 cursor-not-allowed"
                                    )}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            Send Feedback
                                            <Send size={16} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
            {warningDialog}
        </div>
    )
}
