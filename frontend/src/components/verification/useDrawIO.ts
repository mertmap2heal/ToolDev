import { useRef, useState, useCallback, useEffect } from 'react'

/**
 * Draw.io Integration Notes:
 * 
 * "Not a diagram file" error occurs when:
 * 1. XML is empty/undefined - SOLUTION: use EMPTY_DIAGRAM template
 * 2. XML doesn't contain <mxfile - SOLUTION: validate before sending
 * 3. XML is double-encoded - SOLUTION: send raw string, never JSON.stringify the xml value
 * 4. Using ?url= loading with non-XML response - SOLUTION: use postMessage protocol instead
 * 
 * Protocol: https://www.drawio.com/doc/faq/embed-mode
 * - On 'init' event: send {action: 'load', xml: '...'}
 * - On 'save' event: store msg.xml, send {action: 'status', message: 'Saved'}
 * - On 'autosave' event: store msg.xml
 * - On 'exit' event: close editor
 */

// URL for embedded draw.io editor
export const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&ui=min'
export const DRAWIO_ORIGIN = 'https://embed.diagrams.net'

// Empty diagram template that draw.io accepts
export const EMPTY_DIAGRAM = `<mxfile><diagram id="empty" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`

interface UseDrawIOOptions {
  initialXml?: string
  onSave?: (xml: string) => void
  onAutoSave?: (xml: string) => void
  onExit?: () => void
  readOnly?: boolean
}

interface UseDrawIOReturn {
  iframeRef: React.RefObject<HTMLIFrameElement>
  isReady: boolean
  currentXml: string
  error: string | null
  loadDiagram: (xml: string) => void
  exportDiagram: () => void
}

/**
 * Validates and prepares XML for draw.io
 * Logs first 120 chars for debugging
 */
export const prepareXml = (data: any): string => {
  // Log for debugging
  const preview = typeof data === 'string' 
    ? data.substring(0, 120) 
    : JSON.stringify(data).substring(0, 120)
  console.log('[DrawIO] Preparing XML, preview:', preview)

  if (!data) {
    console.log('[DrawIO] No data provided, using empty template')
    return EMPTY_DIAGRAM
  }

  // If it's a string, check if it's valid XML
  if (typeof data === 'string') {
    const trimmed = data.trim()
    if (trimmed.includes('<mxfile')) {
      console.log('[DrawIO] Valid mxfile XML string detected')
      return trimmed
    }
    console.warn('[DrawIO] String does not contain <mxfile, using empty template')
    return EMPTY_DIAGRAM
  }

  // If it's an object with xml property
  if (data && typeof data === 'object') {
    const xml = data.xml
    if (xml && typeof xml === 'string' && xml.includes('<mxfile')) {
      console.log('[DrawIO] Valid XML found in object.xml property')
      return xml.trim()
    }
  }

  console.warn('[DrawIO] Invalid XML data, using empty template')
  return EMPTY_DIAGRAM
}

/**
 * Extracts XML from various data formats
 */
export const extractXml = (diagramData: any): string => {
  if (!diagramData) return EMPTY_DIAGRAM

  // If it's already a string with valid XML
  if (typeof diagramData === 'string' && diagramData.includes('<mxfile')) {
    return diagramData.trim()
  }

  // If it's an object with xml property
  if (diagramData?.xml && typeof diagramData.xml === 'string' && diagramData.xml.includes('<mxfile')) {
    return diagramData.xml.trim()
  }

  return EMPTY_DIAGRAM
}

/**
 * Custom hook for draw.io integration using postMessage protocol
 */
export function useDrawIO(options: UseDrawIOOptions = {}): UseDrawIOReturn {
  const {
    initialXml,
    onSave,
    onAutoSave,
    onExit,
    readOnly = false,
  } = options

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [currentXml, setCurrentXml] = useState<string>(prepareXml(initialXml))
  const [error, setError] = useState<string | null>(null)
  const pendingLoadRef = useRef<string | null>(null)

  // Load diagram into draw.io
  const loadDiagram = useCallback((xml: string) => {
    const preparedXml = prepareXml(xml)
    console.log('[DrawIO] loadDiagram called, isReady:', isReady)
    
    if (!isReady) {
      // Store for later when iframe is ready
      pendingLoadRef.current = preparedXml
      console.log('[DrawIO] Iframe not ready, queuing load')
      return
    }

    const iframe = iframeRef.current
    if (!iframe?.contentWindow) {
      console.error('[DrawIO] No iframe content window')
      setError('Draw.io iframe not available')
      return
    }

    try {
      const message = {
        action: 'load',
        xml: preparedXml,
        autosave: !readOnly ? 1 : 0,
      }
      console.log('[DrawIO] Sending load action')
      iframe.contentWindow.postMessage(JSON.stringify(message), DRAWIO_ORIGIN)
      setCurrentXml(preparedXml)
      setError(null)
    } catch (err) {
      console.error('[DrawIO] Error sending message:', err)
      setError('Failed to communicate with draw.io')
    }
  }, [isReady, readOnly])

  // Export current diagram
  const exportDiagram = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !isReady) {
      console.warn('[DrawIO] Cannot export - iframe not ready')
      return
    }

    try {
      const message = {
        action: 'export',
        format: 'xml',
      }
      iframe.contentWindow.postMessage(JSON.stringify(message), DRAWIO_ORIGIN)
    } catch (err) {
      console.error('[DrawIO] Error requesting export:', err)
    }
  }, [isReady])

  // Handle messages from draw.io
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== DRAWIO_ORIGIN) {
        return
      }

      let msg: any
      try {
        msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        // Not a JSON message, ignore
        return
      }

      console.log('[DrawIO] Received event:', msg.event)

      switch (msg.event) {
        case 'init': {
          // draw.io is ready, load the diagram
          console.log('[DrawIO] Init event received, editor is ready')
          setIsReady(true)
          setError(null)

          // Load the diagram
          const xmlToLoad = pendingLoadRef.current || currentXml
          pendingLoadRef.current = null

          const iframe = iframeRef.current
          if (iframe?.contentWindow) {
            const loadMessage = {
              action: 'load',
              xml: xmlToLoad,
              autosave: !readOnly ? 1 : 0,
            }
            console.log('[DrawIO] Sending initial load')
            iframe.contentWindow.postMessage(JSON.stringify(loadMessage), DRAWIO_ORIGIN)
          }
          break
        }

        case 'load':
          console.log('[DrawIO] Load complete')
          break

        case 'autosave':
          // Auto-save event - store the XML
          if (msg.xml) {
            console.log('[DrawIO] Autosave event')
            setCurrentXml(msg.xml)
            onAutoSave?.(msg.xml)
          }
          break

        case 'save':
          // Save event - store the XML and confirm
          if (msg.xml) {
            console.log('[DrawIO] Save event')
            setCurrentXml(msg.xml)
            onSave?.(msg.xml)
            
            // Send status confirmation
            const iframe = iframeRef.current
            if (iframe?.contentWindow) {
              const statusMessage = {
                action: 'status',
                message: 'Saved',
                modified: false,
              }
              iframe.contentWindow.postMessage(JSON.stringify(statusMessage), DRAWIO_ORIGIN)
            }
          }
          break

        case 'export':
          // Export completed
          if (msg.data) {
            console.log('[DrawIO] Export event')
            setCurrentXml(msg.data)
            onSave?.(msg.data)
          }
          break

        case 'exit':
          // User clicked exit
          console.log('[DrawIO] Exit event')
          onExit?.()
          break

        case 'configure':
          // Configuration request - we can customize draw.io here
          console.log('[DrawIO] Configure event')
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [currentXml, readOnly, onSave, onAutoSave, onExit])

  return {
    iframeRef,
    isReady,
    currentXml,
    error,
    loadDiagram,
    exportDiagram,
  }
}

/**
 * Get the draw.io embed URL with optional parameters
 */
export function getDrawIOUrl(options: {
  readOnly?: boolean
  noSaveBtn?: boolean
  noExitBtn?: boolean
} = {}): string {
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '1',
    libraries: '1',
    ui: 'min',
  })

  if (options.readOnly) {
    params.set('chrome', '0')
  }
  if (options.noSaveBtn) {
    params.set('noSaveBtn', '1')
  }
  if (options.noExitBtn) {
    params.set('noExitBtn', '1')
  }

  return `https://embed.diagrams.net/?${params.toString()}`
}

export default useDrawIO
