import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

// Suppress known non-actionable errors from browser extensions and third-party code:
// - MessageNotSentError / cookieManager.injectClientScript: extension messaging when content script isn't loaded
// - RegisterClientLocalizationsError / translations: extension or IDE localization code
// These are not from this app and can be ignored.
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  const name = reason?.name
  const message = String(reason?.message ?? '')
  const messageName = typeof (reason as any)?.messageName === 'string' ? (reason as any).messageName : ''
  if (
    name === 'RegisterClientLocalizationsError' ||
    name === 'MessageNotSentError' ||
    message.includes('Receiving end does not exist') ||
    message.includes("reading 'translations'") ||
    messageName === 'cookieManager.injectClientScript'
  ) {
    event.preventDefault()
    event.stopPropagation()
  }
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
