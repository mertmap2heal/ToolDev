import { useState } from 'react'
import { Plus } from 'lucide-react'
import CreateProjectModal from './CreateProjectModal'

export default function CreateProjectButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors text-sm"
      >
        <Plus size={16} />
        <span>Create Project</span>
      </button>
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
