import { useState } from 'react'
import { toPng, toSvg } from 'html-to-image'
import { Download, Image, FileCode, Loader } from 'lucide-react'

interface DiagramExporterProps {
  targetRef: React.RefObject<HTMLDivElement>
  filename?: string
}

/**
 * DiagramExporter provides export functionality for ReactFlow diagrams
 * supporting PNG, SVG, and JSON export formats.
 */
export default function DiagramExporter({ targetRef, filename = 'diagram' }: DiagramExporterProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'png' | 'svg'>('png')

  const exportDiagram = async () => {
    if (!targetRef.current) return

    setIsExporting(true)
    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const exportFilename = `${filename}-${timestamp}`

      // Find the ReactFlow viewport element
      const viewport = targetRef.current.querySelector('.react-flow__viewport') as HTMLElement
      if (!viewport) {
        console.error('ReactFlow viewport not found')
        return
      }

      // Get the actual content bounds
      const nodes = targetRef.current.querySelectorAll('.react-flow__node')
      if (nodes.length === 0) {
        console.error('No nodes found in diagram')
        return
      }

      // Export options for better quality
      const exportOptions = {
        backgroundColor: '#f9fafb',
        quality: 1,
        pixelRatio: 2,
        filter: (node: HTMLElement) => {
          // Exclude controls and minimap from export
          const excludeClasses = ['react-flow__controls', 'react-flow__minimap', 'react-flow__panel']
          return !excludeClasses.some((cls) => node.classList?.contains(cls))
        },
      }

      if (exportFormat === 'png') {
        const dataUrl = await toPng(targetRef.current, exportOptions)
        const link = document.createElement('a')
        link.download = `${exportFilename}.png`
        link.href = dataUrl
        link.click()
      } else {
        const dataUrl = await toSvg(targetRef.current, exportOptions)
        const link = document.createElement('a')
        link.download = `${exportFilename}.svg`
        link.href = dataUrl
        link.click()
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={exportFormat}
        onChange={(e) => setExportFormat(e.target.value as 'png' | 'svg')}
        className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        disabled={isExporting}
      >
        <option value="png">PNG Image</option>
        <option value="svg">SVG Vector</option>
      </select>
      <button
        onClick={exportDiagram}
        disabled={isExporting}
        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-1"
      >
        {isExporting ? (
          <>
            <Loader size={14} className="animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            {exportFormat === 'png' ? <Image size={14} /> : <FileCode size={14} />}
            Export
          </>
        )}
      </button>
    </div>
  )
}
