import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api, mediaUrl } from '../utils/api.js'

const CartContext = createContext(null)
const sameLine = (a, b) => a.id === b.id && a.size === b.size && a.color === b.color
function readCart(value) {
  try {
    const saved = JSON.parse(value || '[]')
    if (!Array.isArray(saved)) return []
    const quantities = new Map()
    return saved.flatMap((item) => {
      if (!item || !Number.isInteger(item.id) || item.id < 1 || typeof item.name !== 'string' || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1) return []
      const quantity = Math.min(item.quantity, 20 - (quantities.get(item.id) || 0))
      if (!quantity) return []
      quantities.set(item.id, (quantities.get(item.id) || 0) + quantity)
      return [{ ...item, quantity, size: ['XS', 'S', 'M', 'L', 'XL'].includes(item.size) ? item.size : 'M', color: typeof item.color === 'string' && item.color.length <= 30 ? item.color : 'Modèle présenté' }]
    })
  } catch { return [] }
}
export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => readCart(localStorage.getItem('vd_cart')))
  const [toast, setToast] = useState('')
  const timer = useRef()
  useEffect(() => { localStorage.setItem('vd_cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => {
    const changed = (event) => { if (event.key === 'vd_cart') setCart(readCart(event.newValue)) }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  function showToast(message) {
    clearTimeout(timer.current)
    setToast(message)
    timer.current = setTimeout(() => setToast(''), 3000)
  }
  function addToCart(product, size = 'M', color = 'Modèle présenté', quantity = 1) {
    if (!Number.isInteger(quantity) || quantity < 1) return
    const limit = Math.min(20, product.stock ?? 20)
    const currentQuantity = cart.filter((item) => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0)
    if (currentQuantity + quantity > limit) return showToast(`Quantité indisponible : ${limit} maximum pour cette robe.`)
    setCart((items) => {
      if (items.filter((item) => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0) + quantity > limit) return items
      const incoming = { ...product, size, color, quantity }
      const existing = items.findIndex((item) => sameLine(item, incoming))
      if (existing < 0) return [...items, incoming]
      return items.map((item, index) => index === existing ? { ...item, quantity: item.quantity + quantity } : item)
    })
    showToast('Produit ajouté au panier')
  }
  const refreshCart = useCallback(async () => {
    const products = await api('/products', { auth: false })
    const catalog = new Map(products.map((product) => [product.id, product]))
    setCart((items) => items.map((item) => {
      const product = catalog.get(item.id)
      return product ? { ...item, ...product, image: mediaUrl(product.image), unavailable: product.stock === 0 } : { ...item, unavailable: true }
    }))
  }, [])
  function updateQuantity(index, delta) {
    setCart((items) => items.map((item, i) => {
      if (i !== index) return item
      const other = items.reduce((sum, line, j) => j !== i && line.id === item.id ? sum + line.quantity : sum, 0)
      return { ...item, quantity: delta < 0 ? Math.max(1, item.quantity + delta) : Math.max(1, Math.min(Math.min(20, item.stock ?? 20) - other, item.quantity + delta)) }
    }))
  }
  const removePurchased = useCallback((purchased) => {
    setCart((items) => items.flatMap((item) => {
      const ordered = purchased.filter((line) => sameLine(line, item)).reduce((sum, line) => sum + line.quantity, 0)
      return item.quantity > ordered ? [{ ...item, quantity: item.quantity - ordered }] : []
    }))
  }, [])
  const subtotal = Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
  const shipping = cart.length ? 8 : 0
  return <CartContext.Provider value={{ cart, addToCart, showToast, subtotal, shipping, total: subtotal + shipping, updateQuantity, refreshCart, removePurchased,
    removeItem: (index) => setCart((items) => items.filter((_, i) => i !== index)),
  }}>{children}{toast && <div className="store-toast" role="status">{toast}</div>}</CartContext.Provider>
}
export const useCart = () => useContext(CartContext)
