import { Plus } from 'lucide-react'

export default function CreateProjectButton() {
  return (
    <button className="w-full md:w-auto bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors">
      <Plus size={20} />
      <span>Create a New Project</span>
    </button>
  )
}
