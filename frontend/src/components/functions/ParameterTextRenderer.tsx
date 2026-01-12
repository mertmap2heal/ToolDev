import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'
import ParameterDetailsModal from '../parameters/ParameterDetailsModal'
import type { Parameter } from '../../../shared/types/engineering.types'

interface ParameterTextRendererProps {
  text: string
  projectId: string
}

export default function ParameterTextRenderer({ text, projectId }: ParameterTextRendererProps) {
  const [clickedParameter, setClickedParameter] = useState<string | null>(null)

  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const response = await parameterService.getParameters(projectId)
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
    enabled: !!projectId,
  })

  const renderTextWithParameters = () => {
    if (!text) return null

    // Match pattern: @parameterName@
    const regex = /@(\w+)@/g
    const parts: (string | { type: 'parameter'; name: string })[] = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      // Add text before the parameter
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      // Add the parameter
      parts.push({ type: 'parameter', name: match[1] })
      lastIndex = regex.lastIndex
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.map((part, index) => {
      if (typeof part === 'string') {
        return <span key={index}>{part}</span>
      } else {
        const param = parameters.find((p) => p.name === part.name)
        return (
          <span
            key={index}
            onClick={() => setClickedParameter(part.name)}
            className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer underline"
            title={`Click to view parameter details: ${part.name}`}
          >
            {part.name}
          </span>
        )
      }
    })
  }

  const selectedParameter = clickedParameter
    ? parameters.find((p) => p.name === clickedParameter)
    : null

  return (
    <>
      <div className="whitespace-pre-wrap break-words">{renderTextWithParameters()}</div>
      {selectedParameter && (
        <ParameterDetailsModal
          isOpen={!!selectedParameter}
          onClose={() => setClickedParameter(null)}
          parameter={selectedParameter}
        />
      )}
    </>
  )
}
