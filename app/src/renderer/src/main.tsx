import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import Popup from './pages/Popup'
import EdgeBar from './pages/EdgeBar'

const route = window.location.hash.replace(/^#\/?/, '')
const overlay = route === 'popup' || route === 'edgebar'
if (overlay) document.documentElement.classList.add('overlay')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{route === 'popup' ? <Popup /> : route === 'edgebar' ? <EdgeBar /> : <App />}</React.StrictMode>
)
