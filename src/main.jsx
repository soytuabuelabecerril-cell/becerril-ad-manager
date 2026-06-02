import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './context/LanguageContext'
import { DatabaseProvider } from './context/DatabaseContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <DatabaseProvider>
        <App />
      </DatabaseProvider>
    </LanguageProvider>
  </StrictMode>,
)
