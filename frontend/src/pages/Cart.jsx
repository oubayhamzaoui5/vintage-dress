import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { logout } from '../utils/session.js'
import { money } from '../utils/checkout.js'

export default function Cart() {
  const { cart, updateQuantity, removeItem, subtotal, shipping, total, refreshCart } = useCart()
  const { session, status } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const insufficientStock = cart.some((item) => cart.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.quantity, 0) > (item.stock ?? 20))
  useEffect(() => {
    let active = true
    setChecking(true); setError('')
    refreshCart().catch(() => { if (active) setError('Impossible de vérifier les prix. Votre panier est conservé. Réessayez avant de commander.') }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [refreshCart, revision])
  function proceed() {
    if (session?.type === 'admin') { logout(); navigate('/login', { state: { from: '/commande' } }); return }
    navigate('/commande')
  }

  return (
    <main className="container section">
      <div className="page-title">
        <h1>Mon panier</h1>
      </div>
      <div className="breadcrumb">Accueil → Panier</div>
      {error && <p role="alert">{error} <button className="btn" onClick={() => setRevision((n) => n + 1)}>Réessayer</button></p>}
      {insufficientStock && <p role="alert" className="checkout-error">Stock insuffisant. Réduisez les quantités ou retirez une taille pour continuer.</p>}
      <div className="cart-table">
        <table>
          <thead>
            <tr>
              <th>Produit</th><th>Prix</th><th>Taille</th><th>Couleur</th>
              <th>Quantité</th><th>Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {cart.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 50 }}>Votre panier est vide.</td></tr>
            ) : (
              cart.map((item, i) => (
                <tr key={`${item.name}-${item.size}-${item.color}`}>
                  <td>
                    <div className="product-mini">
                      <img src={item.image} alt="" />
                      <span>{item.name}{item.unavailable ? <strong className="checkout-error"> · Indisponible : retirez cette robe.</strong> : item.stock !== undefined && <small> · {item.stock} disponible(s)</small>}</span>
                    </div>
                  </td>
                  <td>{money(item.price)}</td>
                  <td>{item.size}</td>
                  <td>{item.color}</td>
                  <td>
                    <div className="qty">
                      <button type="button" disabled={item.quantity <= 1} aria-label="Diminuer la quantité" onClick={() => updateQuantity(i, -1)}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" disabled={item.unavailable || cart.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.quantity, 0) >= Math.min(20, item.stock ?? 20)} aria-label="Augmenter la quantité" onClick={() => updateQuantity(i, 1)}>+</button>
                    </div>
                  </td>
                  <td>{money(item.price * item.quantity)}</td>
                  <td><button type="button" className="icon-btn danger" aria-label={`Retirer ${item.name}`} onClick={() => removeItem(i)}>🗑</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="cart-bottom">
        <div className="summary">
          <div><span>Sous-total</span><span>{money(subtotal)}</span></div>
          <div><span>Livraison</span><span>{money(shipping)}</span></div>
          <div className="total"><span>Total</span><span>{money(total)}</span></div>
          {session?.type === 'admin' && cart.length > 0 && <p>Pour commander, connectez-vous avec un compte client. Votre panier sera conservé.</p>}
          {cart.length ? <button className="btn full" onClick={proceed} disabled={checking || !!error || insufficientStock || status === 'checking' || cart.some((item) => item.unavailable)}>{checking ? 'Vérification des prix…' : session?.type === 'admin' ? 'Se connecter comme client →' : 'Passer la commande →'}</button> : <Link className="btn full" to="/boutique">Voir la boutique →</Link>}
        </div>
      </div>
    </main>
  )
}
