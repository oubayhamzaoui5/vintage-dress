import { useEffect, useState } from 'react'
import { api, mediaUrl } from '../utils/api.js'
import { money } from '../utils/checkout.js'

export default function OrderDetails({ id }) {
  const [state, setState] = useState({ loading: true, order: null, error: '' })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setState({ loading: true, order: null, error: '' })
    api(`/orders/${id}`).then((order) => { if (active) setState({ loading: false, order, error: '' }) }).catch((error) => { if (active) setState({ loading: false, order: null, error: error.status ? error.message : 'Commande indisponible. Vérifiez votre connexion.' }) })
    return () => { active = false }
  }, [id, revision])
  if (state.loading) return <p role="status">Chargement de la commande…</p>
  if (state.error) return <div><p role="alert" className="checkout-error">{state.error}</p><button className="btn" onClick={() => setRevision((n) => n + 1)}>Réessayer</button></div>
  const order = state.order
  return <div className="order-details">
    <div className="order-status"><strong>Commande #{order.id} · {order.status}</strong><span>{new Date(order.created_at).toLocaleString('fr-FR')}</span></div>
    <ul className="checkout-items">{order.items.map((item, index) => <li key={index}><img src={mediaUrl(item.image)} alt="" /><div><strong>{item.name}</strong><span>Taille {item.size || '—'} · {item.color || 'Modèle présenté'} · Quantité {item.quantity}</span><span>{money(item.unit_price)} par article · {money(item.unit_price * item.quantity)}</span></div></li>)}</ul>
    <dl className="checkout-totals"><div><dt>Sous-total</dt><dd>{money(order.total - order.shipping)}</dd></div><div><dt>Livraison</dt><dd>{money(order.shipping)}</dd></div><div><dt>Total</dt><dd>{money(order.total)}</dd></div></dl>
    <h2>Livraison</h2>{order.address ? <address>{order.customer_name}<br />{order.phone}<br />{order.address}<br />{order.city}</address> : <p>Adresse non renseignée pour cette ancienne commande.</p>}
    <p>{order.status === 'Annulée' ? 'Commande annulée : aucun règlement attendu.' : <><strong>{order.payment_method}</strong> · Montant à régler à la réception : {money(order.total)}.</>}</p>
  </div>
}
