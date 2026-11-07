import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { useCart } from './CartContext.jsx'
import { api, mediaUrl } from '../utils/api.js'

const FavoritesContext = createContext(null)
export function FavoritesProvider({ children }) {
  const { session } = useAuth()
  const userId = session?.type === 'user' ? session.user.id : null
  const navigate = useNavigate()
  const { showToast } = useCart()
  const [state, setState] = useState({ owner: null, rows: [], error: '', loading: false })
  const [busy, setBusy] = useState(false)
  const request = useRef(false)
  const version = useRef(0)
  const owner = useRef(userId)
  owner.current = userId
  const reload = useCallback(async () => {
    const currentVersion = ++version.current
    if (!userId) { setState({ owner: null, rows: [], error: '', loading: false }); return }
    setState((s) => ({ ...s, loading: true, error: '' }))
    try {
      const rows = await api('/account/favorites')
      if (owner.current === userId && version.current === currentVersion) setState({ owner: userId, rows: rows.map((p) => ({ ...p, image: mediaUrl(p.image) })), error: '', loading: false })
    } catch (error) {
      if (owner.current === userId && version.current === currentVersion) setState({ owner: userId, rows: [], error: error.message, loading: false })
    }
  }, [userId])
  useEffect(() => { reload() }, [reload])
  const favorites = state.owner === userId ? state.rows : []
  async function toggle(product) {
    if (!userId) {
      if (session?.type === 'admin') return showToast('Les favoris sont réservés aux comptes clients.')
      navigate('/login', { state: { from: '/boutique' } }); return
    }
    if (request.current || state.loading) return
    request.current = true; setBusy(true)
    const exists = favorites.some((p) => p.id === product.id)
    try {
      await api(`/account/favorites/${product.id}`, { method: exists ? 'DELETE' : 'PUT' })
      if (owner.current === userId) {
        setState((s) => ({ ...s, owner: userId, rows: exists ? s.rows.filter((p) => p.id !== product.id) : [product, ...s.rows] }))
        showToast(exists ? 'Favori retiré' : 'Favori enregistré ✓')
      }
    } catch (error) { showToast(error.message) }
    finally { request.current = false; setBusy(false) }
  }
  return <FavoritesContext.Provider value={{ favorites, error: state.error, loading: state.loading, busy, toggle, reload }}>{children}</FavoritesContext.Provider>
}
export const useFavorites = () => useContext(FavoritesContext)
