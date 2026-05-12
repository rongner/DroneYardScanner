import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { YardProvider } from '@/contexts/YardContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <YardProvider>
          <App />
        </YardProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
