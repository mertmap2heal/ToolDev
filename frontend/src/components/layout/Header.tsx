import { Bell, User as UserIcon } from 'lucide-react'
import Breadcrumbs from './Breadcrumbs'

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Breadcrumbs />
          <div className="mt-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome User!
            </h1>
            <p className="text-gray-600">Company Name</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Bell size={20} className="text-gray-600" />
          </button>
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
            <UserIcon size={20} className="text-white" />
          </div>
        </div>
      </div>
    </header>
  )
}
