import { useState, useEffect, useRef, createElement } from 'react'
import UnsavedChangesDialog from '../components/common/UnsavedChangesDialog'
import DraftBanner from '../components/common/DraftBanner'

/**
 * Guards a modal's close action when the user has unsaved form changes.
 *
 * Usage:
 *   const onDiscardRef = useRef<() => void>()
 *   const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
 *   // ... define state ...
 *   onDiscardRef.current = () => { setFormDataBase(initial); setErrors({}) }
 *
 *   - Call markDirty() on any form field change (or wrap setFormData)
 *   - Replace onClose with guardClose on X / Cancel / ESC / backdrop
 *   - Call resetDirty() before onClose() in a successful mutation handler
 *   - Render {warningDialog} inside the modal JSX (end of outer div)
 *   - Render {draftBanner} below the modal header (shows when form has unsaved data)
 *
 * The warning dialog offers three choices:
 *   "Continue editing"    → stay in the modal, fields intact
 *   "Keep for later"      → close the modal, fields preserved for next open
 *   "Discard all changes" → call onDiscard() to reset fields, then close
 *
 * The draft banner (shown when isDirty) offers a "Discard draft" button that
 * resets the form in-place without closing the modal.
 */
export function useUnsavedChanges(
  onClose: () => void,
  isOpen: boolean,
  onDiscard?: () => void,
) {
  const [isDirty, setIsDirty] = useState(false)
  const [showWarning, setShowWarning] = useState(false)

  // Tracks whether we're in the "just opened" or "just cleared" phase where
  // form state is being initialised/reset — markDirty is suppressed during these windows.
  //
  // justOpenedRef starts as true so that synchronous effects (e.g. TipTap's onUpdate
  // firing during editor mount, before any useEffect runs) are also suppressed.
  const justOpenedRef = useRef(true)
  const justClearedRef = useRef(false)
  const wasOpenRef = useRef(false)

  // Clear initial mount suppression after init effects settle
  useEffect(() => {
    const timer = setTimeout(() => { justOpenedRef.current = false }, 500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const wasOpen = wasOpenRef.current
    wasOpenRef.current = isOpen

    if (isOpen && !wasOpen) {
      // Re-opening: suppress dirty marks until all init effects settle
      justOpenedRef.current = true
      setShowWarning(false)
      const timer = setTimeout(() => {
        justOpenedRef.current = false
      }, 150)
      return () => clearTimeout(timer)
    }

    if (!isOpen) {
      setShowWarning(false)
      setIsDirty(false)
    }
  }, [isOpen])

  const markDirty = () => {
    if (!justOpenedRef.current && !justClearedRef.current) setIsDirty(true)
  }

  const resetDirty = () => setIsDirty(false)

  const guardClose = () => {
    if (isDirty) {
      setShowWarning(true)
    } else {
      onClose()
    }
  }

  // "Continue editing" — stay in modal, nothing changes
  const handleKeepEditing = () => {
    setShowWarning(false)
  }

  // "Keep for later" — close but preserve form data
  const handleKeepForLater = () => {
    setShowWarning(false)
    onClose()
  }

  // "Discard all changes" — reset form fields then close
  const handleDiscardAll = () => {
    setIsDirty(false)
    setShowWarning(false)
    justClearedRef.current = true
    const timer = setTimeout(() => { justClearedRef.current = false }, 0)
    onDiscard?.()
    onClose()
    return () => clearTimeout(timer)
  }

  // "Clear all" from the header button — reset form in-place, stay open
  const handleDiscardInPlace = () => {
    setIsDirty(false)
    justClearedRef.current = true
    setTimeout(() => { justClearedRef.current = false }, 0)
    onDiscard?.()
  }

  const warningDialog = createElement(UnsavedChangesDialog, {
    isOpen: showWarning,
    onKeepEditing: handleKeepEditing,
    onKeepForLater: handleKeepForLater,
    onDiscardAll: handleDiscardAll,
  })

  const draftBanner = isDirty
    ? createElement(DraftBanner, { onDiscard: handleDiscardInPlace })
    : null

  return { isDirty, markDirty, resetDirty, guardClose, warningDialog, draftBanner }
}
