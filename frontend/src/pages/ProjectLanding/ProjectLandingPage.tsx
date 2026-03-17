import { useParams } from 'react-router-dom'

export default function ProjectLandingPage() {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <div className="flex flex-col min-h-[70vh]">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-700 dark:text-gray-300">
          Select a section from the menu above to get started.
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <img
          src="/images/project-landing/icon-light.svg"
          alt=""
          className="max-w-lg w-full dark:hidden"
          aria-hidden
        />
        <img
          src="/images/project-landing/icon-dark.svg"
          alt=""
          className="max-w-lg w-full hidden dark:block"
          aria-hidden
        />
      </div>
    </div>
  )
}
