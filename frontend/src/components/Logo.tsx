interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
}

export default function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: { image: 40, text: 'text-sm' },
    md: { image: 56, text: 'text-base' },
    lg: { image: 72, text: 'text-lg' },
    xl: { image: 120, text: 'text-xl' },
  }

  const currentSize = sizes[size]

  return (
    <div className="flex items-center gap-2">
      <img 
        src="/logo.png" 
        alt="Engineering Tool Logo" 
        className="object-contain"
        style={{ width: `${currentSize.image}px`, height: `${currentSize.image}px` }}
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold ${currentSize.text} text-gray-900 dark:text-white leading-tight`}>
            Engineering Tool
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
            Project Development
          </span>
        </div>
      )}
    </div>
  )
}
