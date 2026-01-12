import { Bell, User as UserIcon, Search, HelpCircle, Settings, Grid, GraduationCap } from 'lucide-react'
import Logo from '../Logo'
import Breadcrumbs from './Breadcrumbs'

export default function Header() {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo/Branding */}
          <div className="flex items-center gap-4">
            <Logo size="md" showText={true} />
          </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
              Ctrl+K
            </span>
          </div>
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg relative">
            <HelpCircle size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg relative">
            <Bell size={18} className="text-gray-600 dark:text-gray-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <GraduationCap size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Settings size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <Grid size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ml-2 cursor-pointer hover:bg-blue-600">
            <span className="text-white font-semibold text-sm">M</span>
          </div>
        </div>
      </div>
      </div>
      {/* Breadcrumbs */}
      <div className="px-6 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <Breadcrumbs />
      </div>
    </header>
  )
}
