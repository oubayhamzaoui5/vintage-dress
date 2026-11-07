import { cloneElement, useEffect, useId, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { logout } from '../utils/auth.js'
import { api } from '../utils/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useFavorites } from '../context/FavoritesContext.jsx'
import { money } from '../utils/checkout.js'
import ProductModal from '../components/ProductModal.jsx'

const badgeClass = { 'En attente': 'progress', 'Expédiée': 'progress', 'Livrée': 'done', 'Annulée': 'cancel' }

const tabs = [
  { id: 'profil', icon: '👤', label: 'Mon compte' },
  { id: 'commandes', icon: '📦', label: 'Mes commandes' },
  { id: 'favoris', icon: '♡', label: 'Mes favoris' },
  { id: 'adresses', icon: '📍', label: 'Mes adresses' },
  { id: 'parametres', icon: '⚙', label: 'Paramètres' },
]

function Field({ label, children, full }) {
  const generatedId = useId()
  const id = children.props.id || generatedId
  return (
    <div className={`acc-field ${full ? 'full-col' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  )
}

export default function Account() {
  const { showToast } = useCart()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { session, updateUser } = useAuth()
  const { favorites, loading: favoritesLoading, error: favoritesError, reload: reloadFavorites, toggle, busy: favoriteBusy } = useFavorites()
  const user = session?.user
  const [orders, setOrders] = useState([])
  const [ordersError, setOrdersError] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const tab = tabs.some((item) => item.id === searchParams.get('onglet')) ? searchParams.get('onglet') : 'profil'
  const setTab = (value) => setSearchParams(value === 'profil' ? {} : { onglet: value })
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    city: user?.city || '',
  })
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [notif, setNotif] = useState({ orders: true, offers: false, news: true })
  const [preferencesReady, setPreferencesReady] = useState(false)
  const [preferencesBusy, setPreferencesBusy] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [accountError, setAccountError] = useState('')
  const [revision, setRevision] = useState(0)
  const [addressForm, setAddressForm] = useState(null)
  const [addressBusy, setAddressBusy] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [selected, setSelected] = useState(null)
  const preferenceRequest = useRef(false)
  const addressRequest = useRef(false)
  const [deleteAddress, setDeleteAddress] = useState(null)
  useEffect(() => {
    let active = true
    setAccountError(''); setPreferencesReady(false)
    api('/account/addresses').then((rows) => { if (active) setAddresses(rows) }).catch((error) => { if (active) setAccountError(error.message) })
    api('/account/preferences').then((values) => { if (active) { setNotif(values); setPreferencesReady(true) } }).catch((error) => { if (active) setAccountError(error.message) })
    return () => { active = false }
  }, [revision, user?.id])
  useEffect(() => {
    let active = true
    api('/orders/mine').then((rows) => { if (active) setOrders(rows) }).catch((error) => {
      if (!active) return
      if ([401, 403].includes(error.status)) { logout(); navigate('/login', { replace: true }) }
      else setOrdersError('Impossible de charger vos commandes. Rechargez la page pour réessayer.')
    })
    return () => { active = false }
  }, [navigate])

  // Non connecté -> retour à la page de connexion
  if (!user) return <Navigate to="/login" replace />

  const initials = (profile.name || profile.email).split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const setP = (k) => (e) => setProfile((p) => ({ ...p, [k]: e.target.value }))

  async function saveProfile(e) {
    e.preventDefault()
    setProfileBusy(true)
    try {
      const { user: saved } = await api('/auth/profile', { method: 'PATCH', body: profile })
      updateUser(saved)
      setProfile({ name: saved.name, email: saved.email, phone: saved.phone || '', city: saved.city || '' })
      showToast('Informations enregistrées ✓')
    } catch (error) { showToast(error.message) }
    finally { setProfileBusy(false) }
  }

  function handleLogout(e) {
    e.preventDefault()
    logout()
    navigate('/login')
  }

  async function savePassword(e) {
    e.preventDefault()
    if (pwd.next.length < 6) return showToast('6 caractères minimum')
    if (pwd.next === pwd.current) return showToast('Choisissez un mot de passe différent de l’actuel')
    if (pwd.next !== pwd.confirm) return showToast('Les mots de passe ne correspondent pas')
    setPasswordBusy(true)
    try {
      await api('/auth/password', { method: 'PATCH', body: { current: pwd.current, next: pwd.next } })
      setPwd({ current: '', next: '', confirm: '' })
      showToast('Mot de passe mis à jour ✓')
    } catch (error) { showToast(error.message) }
    finally { setPasswordBusy(false) }
  }

  async function savePreference(key, checked) {
    if (preferenceRequest.current || !preferencesReady) return
    preferenceRequest.current = true; setPreferencesBusy(true)
    try { setNotif(await api('/account/preferences', { method: 'PATCH', body: { ...notif, [key]: checked } })); showToast('Préférences enregistrées ✓') }
    catch (error) { showToast(error.message) }
    finally { preferenceRequest.current = false; setPreferencesBusy(false) }
  }
  async function changeAddress(path, method, body) {
    if (addressRequest.current) return
    addressRequest.current = true; setAddressBusy(true); setAddressError('')
    try {
      await api(path, { method, body })
      setAddressForm(null); setDeleteAddress(null)
      setAddresses(await api('/account/addresses'))
      showToast('Adresses mises à jour ✓')
    } catch (error) { setAddressError(error.message) }
    finally { addressRequest.current = false; setAddressBusy(false) }
  }

  return (
    <main className="acc-page">
      <div className="container acc-wrap">
        <aside className="acc-side">
          <div className="acc-user">
            <div className="acc-avatar">{initials}</div>
            <strong>{profile.name}</strong>
            <span>{profile.email}</span>
          </div>
          <nav className="acc-nav">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
            <a className="logout" href="/login" onClick={handleLogout}><span>↪</span>Déconnexion</a>
          </nav>
        </aside>

        <div className="acc-main">
          {ordersError && <p role="alert">{ordersError}</p>}
          {accountError && <p role="alert">{accountError} <button className="acc-btn ghost" onClick={() => setRevision((n) => n + 1)}>Réessayer</button></p>}
          <div className="acc-stats">
            <div className="acc-stat"><strong>{orders.length}</strong><span>Commandes passées</span></div>
            <div className="acc-stat">
              <strong>{orders.filter((o) => ['En attente', 'Expédiée'].includes(o.status)).length}</strong>
              <span>Commandes en cours</span>
            </div>
            <div className="acc-stat">
              <strong>{money(orders.filter((o) => o.status === 'Livrée').reduce((s, o) => s + o.total, 0))}</strong>
              <span>Total dépensé</span>
            </div>
          </div>

          {tab === 'profil' && (
            <form className="acc-card" onSubmit={saveProfile}>
              <h2>Informations personnelles</h2>
              <p className="acc-sub">Gardez vos coordonnées à jour pour faciliter vos livraisons.</p>
              <div className="acc-grid">
                <Field label="Nom complet" full><input maxLength={100} autoComplete="name" value={profile.name} onChange={setP('name')} required /></Field>
                <Field label="Email"><input type="email" maxLength={150} autoComplete="email" value={profile.email} onChange={setP('email')} required /></Field>
                <Field label="Téléphone"><input type="tel" maxLength={30} autoComplete="tel" value={profile.phone} onChange={setP('phone')} /></Field>
                <Field label="Ville" full><input maxLength={80} autoComplete="address-level2" value={profile.city} onChange={setP('city')} /></Field>
              </div>
              <div className="acc-actions">
                <button className="acc-btn" type="submit" disabled={profileBusy}>{profileBusy ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          )}

          {tab === 'commandes' && (
            <section className="acc-card">
              <h2>Mes commandes</h2>
              <p className="acc-sub">Suivez l'état de vos achats.</p>
              {orders.length === 0 ? (
                <div className="acc-empty">Vous n'avez pas encore passé de commande.</div>
              ) : (
              <div className="acc-scroll">
                <table className="acc-table">
                  <thead>
                    <tr><th>Commande</th><th>Date</th><th>Articles</th><th>Total</th><th>Statut</th></tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><Link to={`/commandes/${o.id}`}>#{o.id} · Voir</Link></td>
                        <td>{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                        <td>{o.items}</td>
                        <td>{o.total} TND</td>
                        <td><span className={`acc-badge ${badgeClass[o.status]}`}>{o.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </section>
          )}

          {tab === 'favoris' && (
            <section className="acc-card">
              <h2>Mes favoris</h2>
              {favoritesLoading ? <p role="status">Chargement…</p> : favoritesError ? <p role="alert">{favoritesError} <button className="acc-btn ghost" onClick={reloadFavorites}>Réessayer</button></p> : favorites.length ? <div className="product-grid">{favorites.map((product) => <article className="product-card" key={product.id}>
                <div className="product-image"><img src={product.image} alt={product.name} /></div>
                <div className="product-info"><h3>{product.name}</h3><p className="price">{money(product.price)}</p>
                  <button className="acc-btn" onClick={() => setSelected(product)}>Voir la robe</button>{' '}
                  <button className="acc-btn ghost" disabled={favoriteBusy} onClick={() => toggle(product)}>Retirer</button></div>
              </article>)}</div> : <div className="acc-empty">
                <p>Vous n'avez pas encore de favoris.</p>
                <Link className="acc-btn" style={{ display: 'inline-grid', placeItems: 'center', marginTop: 16 }} to="/boutique">
                  Découvrir la boutique
                </Link>
              </div>}
            </section>
          )}

          {tab === 'adresses' && (
            <section className="acc-card">
              <h2>Mes adresses</h2>
              <p className="acc-sub">Adresses utilisées pour vos livraisons.</p>
              {addressError && <p role="alert">{addressError}</p>}
              {addresses.length ? (
                <div className="acc-addr">
                  {addresses.map((address) => <div className="acc-addr-item main" key={address.id}>
                    <b>{address.name} {address.is_default ? <span className="acc-tag">• Par défaut</span> : null}</b>
                    <div style={{ whiteSpace: 'pre-line' }}>{address.address}</div><div>{address.city}, Tunisie</div><div>{address.phone}</div>
                    <div className="acc-actions">{!address.is_default && <button className="acc-btn ghost" disabled={addressBusy} onClick={() => changeAddress(`/account/addresses/${address.id}/default`, 'PATCH')}>Définir par défaut</button>}{' '}
                      <button className="acc-btn ghost" disabled={addressBusy} onClick={() => setDeleteAddress(address.id)}>Supprimer</button></div>
                    {deleteAddress === address.id && <p>Supprimer cette adresse ? <button className="acc-btn" disabled={addressBusy} onClick={() => changeAddress(`/account/addresses/${address.id}`, 'DELETE')}>Confirmer</button>{' '}<button className="acc-btn ghost" disabled={addressBusy} onClick={() => setDeleteAddress(null)}>Annuler</button></p>}
                  </div>)}
                </div>
              ) : (
                <div className="acc-empty">Aucune adresse enregistrée.</div>
              )}
              {addressForm && <form onSubmit={(e) => { e.preventDefault(); changeAddress('/account/addresses', 'POST', addressForm) }}>
                <div className="acc-grid">{[['name', 'Nom complet', 100, 'name'], ['phone', 'Téléphone', 30, 'tel'], ['city', 'Ville', 80, 'address-level2'], ['address', 'Adresse complète', 500, 'street-address']].map(([key, label, max, autocomplete]) => <Field key={key} label={label} full={key === 'address'}><input required type={key === 'phone' ? 'tel' : 'text'} autoComplete={autocomplete} maxLength={max} disabled={addressBusy} value={addressForm[key]} onChange={(e) => setAddressForm((f) => ({ ...f, [key]: e.target.value }))} /></Field>)}</div>
                <div className="acc-actions"><button className="acc-btn" disabled={addressBusy}>{addressBusy ? 'Enregistrement…' : 'Enregistrer l’adresse'}</button>{' '}<button type="button" className="acc-btn ghost" disabled={addressBusy} onClick={() => setAddressForm(null)}>Annuler</button></div>
              </form>}
              <div className="acc-actions">
                <button className="acc-btn ghost" disabled={addressBusy || !!addressForm || addresses.length >= 10} onClick={() => { setAddressError(''); setAddressForm({ name: profile.name, phone: profile.phone, city: profile.city, address: '' }) }}>
                  + Ajouter une adresse
                </button>
              </div>
            </section>
          )}

          {tab === 'parametres' && (
            <>
              <form className="acc-card" onSubmit={savePassword}>
                <h2>Mot de passe</h2>
                <p className="acc-sub">Choisissez un mot de passe d'au moins 6 caractères.</p>
                <div className="acc-grid">
                  <Field label="Mot de passe actuel" full>
                    <input type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
                  </Field>
                  <Field label="Nouveau mot de passe">
                    <input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required />
                  </Field>
                  <Field label="Confirmation">
                    <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
                  </Field>
                </div>
                <div className="acc-actions">
                  <button className="acc-btn" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Mise à jour…' : 'Mettre à jour'}</button>
                </div>
              </form>

              <section className="acc-card">
                <h2>Notifications</h2>
                <p className="acc-sub">Préférences enregistrées dans votre compte. L’envoi d’e-mails n’est pas activé pour cette démonstration.</p>
                {[
                  ['orders', 'Suivi des commandes', 'Confirmation et livraison'],
                  ['offers', 'Offres et promotions', 'Réductions et ventes privées'],
                  ['news', 'Nouveautés', 'Nouvelles robes ajoutées à la boutique'],
                ].map(([key, title, desc]) => (
                  <label className="acc-switch" key={key}>
                    <span>{title}<small>{desc}</small></span>
                    <input
                      type="checkbox"
                      checked={notif[key]}
                      disabled={!preferencesReady || preferencesBusy}
                      onChange={(e) => savePreference(key, e.target.checked)}
                    />
                  </label>
                ))}
              </section>
            </>
          )}
        </div>
      </div>
      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </main>
  )
}
