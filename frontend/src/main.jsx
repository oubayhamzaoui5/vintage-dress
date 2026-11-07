import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CartProvider } from './context/CartContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { FavoritesProvider } from './context/FavoritesContext.jsx'
import App from './App.jsx'
import './styles/main.css'
import './styles/design-system.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AuthProvider><CartProvider><FavoritesProvider><App /></FavoritesProvider></CartProvider></AuthProvider></BrowserRouter></React.StrictMode>,
)
