import { useQuery } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'
import { useParameterDisplayStore } from '../../store/parameterDisplayStore'
import {
  resolveParameterPlaceholders,
  extractParameterIds,
  editorSpansToPlaceholders,
  type ParameterResolveEntry,
} from '../../utils/parameterPlaceholder'

interface RequirementParameterTextProps {
  projectId: string
  text: string
  className?: string
  /** Strip HTML for plain text display (e.g. list view) */
  stripHtml?: boolean
}

function stripHtmlSimple(html: string): string {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent ?? tmp.innerText ?? ''
}

export default function RequirementParameterText({
  projectId,
  text,
  className = '',
  stripHtml = false,
}: RequirementParameterTextProps) {
  const mode = useParameterDisplayStore((s) => s.mode)

  const rawForCheck = stripHtml ? stripHtmlSimple(text || '') : (text || '')
  const hasPlaceholderLike =
    rawForCheck.includes('{{param:') ||
    rawForCheck.includes('param:') ||
    rawForCheck.includes('data-param-id')

  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const res = await parameterService.getParameters(projectId)
      if (res.success && res.data) return res.data
      return []
    },
    enabled: !!projectId && !!text && hasPlaceholderLike,
  })

  const raw = stripHtml ? stripHtmlSimple(text) : text
  const normalized = editorSpansToPlaceholders(raw)
  const ids = extractParameterIds(normalized)

  const map = new Map<string, ParameterResolveEntry>()
  parameters.forEach((p) => {
    map.set(p.id.toLowerCase(), {
      id: p.id,
      name: p.name,
      defaultValue: p.defaultValue,
      unit: p.unit,
      tolerance: p.tolerance,
      minValue: p.minValue,
      maxValue: p.maxValue,
    })
  })

  const resolved = resolveParameterPlaceholders(normalized, map, mode)
  return <span className={className}>{resolved}</span>
}
