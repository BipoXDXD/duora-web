import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fontes servidas pelo próprio site (OFL 1.1), sem chamada ao Google Fonts. O eixo opsz deixa o
// Fraunces mais contrastado nos títulos grandes.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/hanken-grotesk/index.css'
import './index.css'
import { App } from './app/App.tsx'

const root = document.getElementById('root')
if (root === null) {
  throw new Error('index.html sem o elemento #root')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
