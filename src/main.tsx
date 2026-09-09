import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Public synthetic showcase only. Private/local builds and portable exports
// do not load this adapter. The vendored script has no collection endpoint.
if (import.meta.env.MODE === 'showcase') {
  const observerScript = document.createElement('script')
  observerScript.src = `${import.meta.env.BASE_URL}observatory.js`
  observerScript.defer = true
  document.head.append(observerScript)
}
