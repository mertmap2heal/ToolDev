import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { aiService } from '../../services/ai.service'

interface AIGuidancePanelProps {
  projectId: string
  stage: string
  context?: string
}

export default function AIGuidancePanel({
  projectId,
  stage,
  context,
}: AIGuidancePanelProps) {
  const [guidance, setGuidance] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const fetchGuidance = async () => {
    setLoading(true)
    try {
      const response = await aiService.getGuidance({
        projectId,
        stage,
        context: context || '',
        prompt: 'Provide guidance for this stage',
      })

      if (response.success && response.data) {
        setGuidance(response.data.guidance)
        setSuggestions(response.data.suggestions)
      }
    } catch (error) {
      console.error('Error fetching AI guidance:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-blue-500" size={20} />
        <h3 className="font-semibold text-gray-900">AI Guidance</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : guidance ? (
        <div className="space-y-4">
          <div>
            <p className="text-gray-700 whitespace-pre-wrap">{guidance}</p>
          </div>
          {suggestions.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Suggestions:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={fetchGuidance}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Get AI Guidance
        </button>
      )}
    </div>
  )
}
