import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { api } from '../utils/api.js'
import { logout } from '../utils/session.js'
import { money } from '../utils/checkout.js'

export default function Checkout() {
  const { session } = useAuth()
  const user = session.user
  const { cart, subtotal, shipping, total, refreshCart, removePurchased, showToast } = useCart()
  const navigate = useNavigate()
  const key = `vd_checkout_${user.id}`
  const initial = useRef(null)
  if (!initial.current) {
    try { initial.current = JSON.parse(sessionStorage.getItem(key) || 'null') } catch { /* ignore damaged draft */ }
    if (!initial.current || typeof initial.current.delivery !== 'object') initial.current = { delivery: {} }
  }
  const saved = initial.current.delivery || {}
  const hasDraft = !!initial.current.delivery?.address
  const [delivery, setDelivery] = useState({ name: saved.name || user.name || '', phone: saved.phone || user.phone || '', city: saved.city || user.city || '', address: saved.address || '' })
  const attempt = useRef(initial.current.attempt || null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const editedDelivery = useRef(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const insufficientStock = cart.some((item) => cart.filter((line) => line.id === item.id).reduce((sum, line) => sum + line.quantity, 0) > (item.stock ?? 20))
  useEffect(() => {
    let active = true
    if (!hasDraft) api('/account/addresses').then((addresses) => {
      const preferred = addresses.find((address) => address.is_default)
      if (active && preferred && !editedDelivery.current) setDelivery({ name: preferred.name, phone: preferred.phone, city: preferred.city, address: preferred.address })
    }).catch(() => { /* Delivery remains editable if saved addresses are unavailable. */ })
    return () => { active = false }
  }, [hasDraft, user.id])
  useEffect(() => {
    let active = true
    setReady(false); setError('')
    async function prepare() {
      if (attempt.current?.key) {
        try {
          const order = await api(`/orders/request/${attempt.current.key}`)
          if (!active) return
          try {
            const submitted = JSON.parse(attempt.current.signature)
            if (Array.isArray(submitted.items)) removePurchased(submitted.items.map((item) => ({ ...item, id: item.product_id })))
          } catch { /* A damaged local draft must not hide an already confirmed order. */ }
          sessionStorage.removeItem(key)
          navigate(`/commandes/${order.id}`, { replace: true })
          return
        } catch (error) {
          if (error.status !== 404) throw error
        }
      }
      await refreshCart()
      if (active) setReady(true)
    }
    prepare().catch((error) => {
      if (!active) return
      if ([401, 403].includes(error.status)) { logout(); navigate('/login', { replace: true, state: { from: '/commande' } }) }
      else setError('Impossible de vérifier votre commande et les disponibilités. Votre panier est conservé. Réessayez.')
    })
    return () => { active = false }
  }, [refreshCart, revision, key, navigate, removePurchased])
  useEffect(() => { sessionStorage.setItem(key, JSON.stringify({ delivery, attempt: attempt.current })) }, [delivery, key])
  const change = (field) => (event) => { editedDelivery.current = true; setDelivery((current) => ({ ...current, [field]: event.target.value })) }
  async function submit(event) {
    event.preventDefault()
    if (submitting.current || !ready || !cart.length || insufficientStock || cart.some((item) => item.unavailable)) return
    const normalized = Object.fromEntries(Object.entries(delivery).map(([field, value]) => [field, value.trim()]))
    if (Object.values(normalized).some((value) => !value)) { setError('Complétez toutes les coordonnées de livraison.'); return }
    if (!/^[+\d\s().-]{6,30}$/.test(normalized.phone) || normalized.phone.replace(/\D/g, '').length < 6) { setError('Saisissez un numéro de téléphone valide.'); return }
    const purchased = cart.map((item) => ({ ...item }))
    const payload = { delivery: normalized, payment_method: 'cash_on_delivery', items: purchased.map((item) => ({ product_id: item.id, quantity: item.quantity, size: item.size, color: item.color })) }
    const signature = JSON.stringify(payload)
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() }
    sessionStorage.setItem(key, JSON.stringify({ delivery, attempt: attempt.current }))
    submitting.current = true; setBusy(true); setError('')
    try {
      const order = await api('/orders', { method: 'POST', body: { ...payload, request_key: attempt.current.key, expected_total: total } })
      removePurchased(purchased)
      sessionStorage.removeItem(key)
      navigate(`/commandes/${order.id}`, { replace: true, state: { placed: true } })
    } catch (err) {
      if ([401, 403].includes(err.status)) {
        logout(); showToast('Reconnectez-vous pour confirmer votre commande. Votre panier est conservé.')
        navigate('/login', { replace: true, state: { from: '/commande' } })
      } else {
        if (['PRICE_CHANGED', 'OUT_OF_STOCK'].includes(err.code)) {
          try { await refreshCart() } catch { setReady(false) }
        }
        setError(err.status ? err.message : 'Confirmation non reçue. Votre panier est conservé. Réessayez avec les mêmes coordonnées : votre commande ne sera pas créée en double.')
      }
    } finally { submitting.current = false; setBusy(false) }
  }
  if (!cart.length) return <main className="container section"><h1>Votre panier est vide</h1><p>Ajoutez une robe pour passer une commande.</p><Link className="btn" to="/boutique">Voir la boutique</Link></main>
  return <main className="container section">
    <h1>Finaliser ma commande</h1>
    <p><Link to="/panier">Retour au panier</Link></p>
    <div className="checkout-layout">
      <form className="checkout-form form" onSubmit={submit}>
        <h2>Coordonnées de livraison</h2>
        <p>Commande au nom de {user.email}.</p>
        <fieldset disabled={busy}>
          <label htmlFor="delivery-name">Nom complet</label><input id="delivery-name" autoComplete="name" required maxLength={100} value={delivery.name} onChange={change('name')} />
          <label htmlFor="delivery-phone">Téléphone</label><input id="delivery-phone" type="tel" autoComplete="tel" required maxLength={30} value={delivery.phone} onChange={change('phone')} />
          <label htmlFor="delivery-city">Ville</label><input id="delivery-city" autoComplete="address-level2" required maxLength={80} value={delivery.city} onChange={change('city')} />
          <label htmlFor="delivery-address">Adresse complète</label><textarea id="delivery-address" autoComplete="street-address" required maxLength={500} value={delivery.address} onChange={change('address')} />
          <h2>Paiement à la livraison</h2><p>Réglez {money(total)} à la réception. Aucun paiement en ligne.</p>
          {error && <p role="alert" className="checkout-error">{error}</p>}
          {!ready && !error && <p role="status">Vérification des prix…</p>}
          {!ready && error && <button type="button" className="btn" onClick={() => setRevision((n) => n + 1)}>Réessayer</button>}
          {cart.some((item) => item.unavailable) && <p role="alert" className="checkout-error">Une robe est indisponible. <Link to="/panier">Retirez-la du panier</Link> pour continuer.</p>}
          {insufficientStock && <p role="alert" className="checkout-error">Stock insuffisant. <Link to="/panier">Réduisez les quantités du panier.</Link></p>}
          <button className="btn full" type="submit" disabled={busy || !ready || insufficientStock || cart.some((item) => item.unavailable)}>{busy ? 'Confirmation en cours…' : `Confirmer la commande · ${money(total)}`}</button>
        </fieldset>
      </form>
      <aside className="checkout-summary"><h2>Votre commande</h2>
        <ul className="checkout-items">{cart.map((item) => <li key={`${item.id}-${item.size}-${item.color}`}><img src={item.image} alt="" /><div><strong>{item.name}</strong><span>Taille {item.size} · {item.color || 'Modèle présenté'} · Quantité {item.quantity}</span><span>{money(item.price * item.quantity)}</span></div></li>)}</ul>
        <dl className="checkout-totals"><div><dt>Sous-total</dt><dd>{money(subtotal)}</dd></div><div><dt>Livraison</dt><dd>{money(shipping)}</dd></div><div><dt>Total à régler à la livraison</dt><dd>{money(total)}</dd></div></dl>
      </aside>
    </div>
  </main>
}
