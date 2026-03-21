import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply saved theme before first paint to avoid flash
try {
  const savedTheme = localStorage.getItem('track-editor-theme') || 'dark';
  document.documentElement.dataset.theme = savedTheme;
} catch {
  document.documentElement.dataset.theme = 'dark';
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
