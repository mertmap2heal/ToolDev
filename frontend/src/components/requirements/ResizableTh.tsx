import React, { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'

interface ResizableThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  width: number
  onResize: (newWidth: number) => void
  minWidth?: number
}

export default function ResizableTh({
  width,
  onResize,
  minWidth = 50,
  className,
  children,
  ...props
}: ResizableThProps) {
  const [isResizing, setIsResizing] = useState(false)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
  }

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startXRef.current
      const newWidth = Math.max(minWidth, startWidthRef.current + deltaX)
      onResize(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, onResize, minWidth])

  return (
    <th
      {...props}
      style={{ width, minWidth: width, maxWidth: width, ...props.style }}
      className={clsx('relative group', className)}
    >
      {children}
      <div
        onMouseDown={handleMouseDown}
        className={clsx(
          'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-10',
          isResizing ? 'bg-blue-500' : 'bg-transparent'
        )}
      />
    </th>
  )
}
