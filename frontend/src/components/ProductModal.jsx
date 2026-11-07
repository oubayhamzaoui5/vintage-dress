import { useEffect, useRef, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { useFavorites } from '../context/FavoritesContext.jsx'

export default function ProductModal({ product, onClose }) {
  const dialog = useRef(null)
  const [size, setSize] = useState('M')
  const { addToCart } = useCart()
  const { favorites, toggle, busy, loading } = useFavorites()
  const favorite = favorites.some((p) => p.id === product?.id)
  useEffect(() => {
    if (product) { setSize(product.size || 'M'); dialog.current?.showModal() }
    else dialog.current?.close()
  }, [product])
  return <dialog ref={dialog} className="product-modal" onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
    {product && <><button className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
      <img src={product.image} alt={product.name} /><h2>{product.name}</h2><p>{product.price} TND</p>
      <label>Taille <select value={size} onChange={(e) => setSize(e.target.value)}>{['XS', 'S', 'M', 'L', 'XL'].map((s) => <option key={s}>{s}</option>)}</select></label>
      <button className="btn" disabled={product.stock === 0} onClick={() => { addToCart(product, size); onClose() }}>{product.stock === 0 ? 'Rupture de stock' : 'Ajouter au panier'}</button>
      <button className="btn" disabled={busy || loading} aria-pressed={favorite} onClick={() => { onClose(); toggle(product) }}>{favorite ? '♥ Retirer des favoris' : '♡ Ajouter aux favoris'}</button></>}
  </dialog>
}
