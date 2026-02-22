import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'

// Suppress known non-actionable errors (React Flow internal, Chrome extensions)
window.addEventListener('unhandledrejection', (event) => {
  const name = event.reason?.name
  const message = String(event.reason?.message ?? '')
  if (
    name === 'RegisterClientLocalizationsError' ||
    name === 'MessageNotSentError' ||
    message.includes('Receiving end does not exist')
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
