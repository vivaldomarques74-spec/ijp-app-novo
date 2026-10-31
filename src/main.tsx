import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import './index.css' // Se o seu arquivo de estilos principal tiver outro nome, ajuste aqui

// Verifica se está rodando como App nativo ou Navegador
const isApp = Capacitor.isNativePlatform();
const Router = isApp ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
)