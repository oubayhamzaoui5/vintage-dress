import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api, mediaUrl } from '../utils/api.js'
import { getAdmin, adminLogout, can } from '../utils/adminAuth.js'
import '../styles/admin.css'
import OrderDetails from '../components/OrderDetails.jsx'

const PAGE = 8
const STATUSES = ['En attente', 'Expédiée', 'Livrée', 'Annulée']
const NEXT_STATUS = { 'En attente': ['En attente', 'Expédiée', 'Annulée'], 'Expédiée': ['Expédiée', 'Livrée', 'Annulée'], 'Livrée': ['Livrée'], 'Annulée': ['Annulée'] }
const badge = { 'En attente': 'wait', 'Expédiée': 'ship', 'Livrée': 'ok', 'Annulée': 'no' }
const fmt = (d) => new Date(d).toLocaleDateString('fr-FR')

const NAV = [
  ['dashboard', 'Tableau de bord', 'stats'],
  ['products', 'Produits', 'products:read'],
  ['orders', 'Commandes', 'orders'],
  ['users', 'Utilisateurs', 'users'],
  ['categories', 'Catégories', 'categories'],
  ['messages', 'Messages', 'messages'],
  ['admins', 'Administrateurs', 'admins:create'],
]

/* ---------- hooks & petits composants ---------- */
function useData(path, onAuthError) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    api(path)
      .then((data) => setState({ data, loading: false, error: '' }))
      .catch((e) => {
        if (e.status === 401) return onAuthError()
        setState({ data: null, loading: false, error: e.message })
      })
  }, [path, onAuthError])
  useEffect(load, [load])
  return { ...state, reload: load }
}

function State({ q, empty, children }) {
  if (q.loading) return <div className="ad-empty" role="status">Chargement…</div>
  if (q.error) return <div className="ad-empty err">{q.error} <button className="ad-btn ghost sm" onClick={q.reload}>Réessayer</button></div>
  if (!q.data?.length && empty) return <div className="ad-empty">{empty}</div>
  return children
}

function Pager({ page, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / PAGE))
  useEffect(() => { if (page > pages) onPage(pages) }, [page, pages, onPage])
  if (pages <= 1) return null
  return (
    <div className="ad-pager">
      <button className="ad-btn ghost sm" disabled={page === 1} onClick={() => onPage(page - 1)}>← Précédent</button>
      <span>Page {page} / {pages}</span>
      <button className="ad-btn ghost sm" disabled={page === pages} onClick={() => onPage(page + 1)}>Suivant →</button>
    </div>
  )
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="ad-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ad-modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function Confirm({ text, onYes, onNo, busy, error }) {
  return (
    <Modal title="Confirmation" onClose={() => { if (!busy) onNo() }}>
      <p>{text}</p>
      {error && <p className="ad-admin-error" role="alert">{error}</p>}
      <div className="ad-modal-actions">
        <button className="ad-btn ghost" onClick={onNo} disabled={busy}>Annuler</button>
        <button className="ad-btn danger" onClick={onYes} disabled={busy}>{busy ? '…' : 'Confirmer'}</button>
      </div>
    </Modal>
  )
}

function Toolbar({ search, onSearch, children }) {
  return (
    <div className="ad-toolbar">
      <input type="search" placeholder="Rechercher…" value={search} onChange={(e) => onSearch(e.target.value)} aria-label="Rechercher" />
      {children}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <label className={`ad-field ${error ? 'invalid' : ''}`}>
      {label}{children}{error && <small>{error}</small>}
    </label>
  )
}

/* ---------- vues ---------- */
function Stats({ ctx, go }) {
  const s = useData('/admin/stats', ctx.onAuth)
  const o = useData('/orders', ctx.onAuth)
  const days = useMemo(() => {
    const out = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      out.push({ key, label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), v: Number(s.data?.sales?.find((x) => x.day === key)?.total || 0) })
    }
    return out
  }, [s.data])
  const max = Math.max(...days.map((d) => d.v), 1)

  return (
    <State q={s}>
      {s.data && (
        <>
          <section className="ad-stats">
            {[['Produits', s.data.products], ['Commandes', s.data.orders], ['Utilisateurs', s.data.users], ['Revenus', `${s.data.revenue} TND`]].map(([l, v]) => (
              <div className="ad-stat" key={l}><span>{l}</span><strong>{v}</strong></div>
            ))}
          </section>
          <section className="ad-grid2">
            <div className="ad-card">
              <h2>Ventes des 7 derniers jours</h2>
              <svg viewBox="0 0 350 160" className="ad-chart" role="img" aria-label="Ventes des 7 derniers jours">
                {days.map((d, i) => {
                  const h = (d.v / max) * 110
                  return (
                    <g key={d.key}>
                      <title>{d.v} TND</title>
                      <rect x={i * 50 + 8} y={125 - h} width="34" height={Math.max(h, 3)} rx="3" fill="#8f2f40" opacity={d.v ? 1 : 0.25} />
                      <text x={i * 50 + 25} y="148" textAnchor="middle" fontSize="11" fill="#7a6b6e">{d.label}</text>
                    </g>
                  )
                })}
              </svg>
            </div>
            <div className="ad-card">
              <h2>Produits les plus vendus</h2>
              {s.data.top.length ? (
                <ol className="ad-top-list">{s.data.top.map((t) => <li key={t.name}><span>{t.name}</span><b>{t.sold}</b></li>)}</ol>
              ) : <div className="ad-empty">Aucune vente enregistrée.</div>}
            </div>
          </section>
          <section className="ad-card">
            <h2>Dernières commandes</h2>
            <State q={o} empty="Aucune commande pour l’instant.">
              <OrdersTable rows={(o.data || []).slice(0, 5)} />
            </State>
          </section>
          <section className="ad-card">
            <h2>Actions rapides</h2>
            <div className="ad-quick">
              {ctx.write && <button className="ad-btn ghost" onClick={() => go('products')}>Ajouter un produit</button>}
              <button className="ad-btn ghost" onClick={() => go('orders')}>Gérer les commandes</button>
              {can(ctx.admin, 'users') && <button className="ad-btn ghost" onClick={() => go('users')}>Consulter les utilisateurs</button>}
              {can(ctx.admin, 'admins:create') && <button className="ad-btn ghost" onClick={() => go('admins')}>Gérer les administrateurs</button>}
            </div>
          </section>
        </>
      )}
    </State>
  )
}

function OrdersTable({ rows, onStatus, write, onDetails }) {
  return (
    <div className="ad-scroll">
      <table className="ad-table">
        <thead><tr><th>N°</th><th>Client</th><th>Produit(s)</th><th>Date</th><th>Statut</th><th>Total</th>{onDetails && <th>Détails</th>}</tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td><b>#{o.id}</b></td><td>{o.client}</td><td>{o.product}</td><td>{fmt(o.created_at)}</td>
              <td>
                {write && onStatus ? (
                  <select className={`ad-badge ${badge[o.status]}`} value={o.status} onChange={(e) => onStatus(o, e.target.value)} aria-label={`Statut commande ${o.id}`}>
                    {NEXT_STATUS[o.status].map((s) => <option key={s}>{s}</option>)}
                  </select>
                ) : <span className={`ad-badge ${badge[o.status]}`}>{o.status}</span>}
              </td>
              <td>{o.total} TND</td>
              {onDetails && <td><button className="ad-btn ghost sm" onClick={() => onDetails(o.id)}>Voir</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Orders({ ctx }) {
  const [selected, setSelected] = useState(null)
  const q = useData('/orders', ctx.onAuth)
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1)
  const rows = useMemo(() => (q.data || []).filter((o) =>
    (!status || o.status === status) &&
    `${o.id} ${o.client} ${o.product}`.toLowerCase().includes(search.toLowerCase())), [q.data, search, status])
  async function setOrderStatus(o, st) {
    try { await api(`/orders/${o.id}/status`, { method: 'PATCH', body: { status: st } }); ctx.toast('Statut mis à jour ✓'); q.reload() }
    catch (e) { ctx.toast(e.message, true); q.reload() }
  }
  return (
    <section className="ad-card">
      <Toolbar search={search} onSearch={(v) => { setSearch(v); setPage(1) }}>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Toolbar>
      <State q={q} empty="Aucune commande reçue pour l’instant.">
        {rows.length ? <OrdersTable rows={rows.slice((page - 1) * PAGE, page * PAGE)} write={ctx.write} onStatus={setOrderStatus} onDetails={setSelected} /> : <div className="ad-empty">Aucun résultat.</div>}
        <Pager page={page} total={rows.length} onPage={setPage} />
      </State>
      {selected && <Modal title={`Commande #${selected}`} onClose={() => setSelected(null)}><OrderDetails id={selected} /><button className="ad-btn ghost" onClick={() => setSelected(null)}>Fermer</button></Modal>}
    </section>
  )
}

function ProductForm({ product, categories, onSaved, onClose, ctx }) {
  const [f, setF] = useState({ name: product?.name || '', price: product?.price ?? '', stock: product?.stock ?? 1, category_id: product?.category_id || '' })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(mediaUrl(product?.image) || '')
  const [err, setErr] = useState({}); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!file) { setPreview(mediaUrl(product?.image) || ''); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, product?.image])
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr({ ...err, [k]: '' }) }
  function chooseImage(e) {
    const image = e.target.files?.[0] || null
    let error = ''
    if (image && !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) error = 'Choisissez une photo JPEG, PNG ou WebP.'
    if (image?.size > 5 * 1024 * 1024) error = 'Photo trop volumineuse : 5 Mo maximum.'
    if (error) e.target.value = ''
    setFile(error ? null : image)
    setErr((current) => ({ ...current, image: error }))
  }
  async function submit(e) {
    e.preventDefault()
    const er = {}
    if (!f.name.trim()) er.name = 'Le nom est obligatoire.'
    if (f.price === '' || Number(f.price) < 0 || Number.isNaN(Number(f.price))) er.price = 'Saisissez un prix valide.'
    if (f.stock === '' || !Number.isInteger(Number(f.stock)) || Number(f.stock) < 0 || Number(f.stock) > 1000000) er.stock = 'Stock entier entre 0 et 1 000 000.'
    if (!file && !product?.image) er.image = 'Ajoutez une photo de la robe.'
    if (err.image) er.image = err.image
    setErr(er)
    if (Object.keys(er).length) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append('name', f.name.trim())
      body.append('price', String(Number(f.price)))
      body.append('category_id', f.category_id || '')
      body.append('stock', String(Number(f.stock)))
      if (file) body.append('image', file)
      await api(product ? `/products/${product.id}` : '/products', { method: product ? 'PUT' : 'POST', body })
      ctx.toast(product ? 'Produit modifié ✓' : 'Produit ajouté ✓'); onSaved()
    } catch (x) { setErr((current) => ({ ...current, server: x.message })) } finally { setBusy(false) }
  }
  return (
    <Modal title={product ? 'Modifier la robe' : 'Ajouter une robe'} onClose={() => { if (!busy) onClose() }}>
      <form onSubmit={submit} noValidate className="ad-form">
        {err.server && <p role="alert" className="ad-admin-error">{err.server}</p>}
        <fieldset disabled={busy} className="ad-form-fields">
        <Field label="Nom" error={err.name}><input maxLength={150} value={f.name} onChange={set('name')} /></Field>
        <Field label="Prix (TND)" error={err.price}><input type="number" min="0" max="99999999.99" step="0.01" value={f.price} onChange={set('price')} /></Field>
        <Field label="Stock disponible" error={err.stock}><input type="number" min="0" max="1000000" step="1" value={f.stock} onChange={set('stock')} /></Field>
        <Field label="Catégorie">
          <select value={f.category_id} onChange={set('category_id')}>
            <option value="">— Aucune —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="ad-image-field">
          <label className={`ad-field ${err.image ? 'invalid' : ''}`} htmlFor="product-image">Photo de la robe</label>
          <input id="product-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} aria-invalid={!!err.image} aria-describedby="product-image-help product-image-error" />
          <p id="product-image-help" className="ad-image-help">JPEG, PNG ou WebP · 5 Mo maximum.{product?.image ? ' Sans nouveau fichier, la photo actuelle est conservée.' : ''}</p>
          {err.image && <p id="product-image-error" role="alert" className="ad-image-error">{err.image}</p>}
          {preview && <figure className="ad-image-preview"><img src={preview} alt="Aperçu de la robe" /><figcaption>{file ? file.name : 'Photo actuelle'}</figcaption></figure>}
        </div>
        <div className="ad-modal-actions">
          <button type="button" className="ad-btn ghost" onClick={onClose}>Annuler</button>
          <button className="ad-btn" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
        </fieldset>
      </form>
    </Modal>
  )
}

function Products({ ctx }) {
  const q = useData('/products', ctx.onAuth)
  const cats = useData('/categories', ctx.onAuth)
  const [search, setSearch] = useState(''); const [cat, setCat] = useState(''); const [sort, setSort] = useState('recent'); const [page, setPage] = useState(1)
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const [busy, setBusy] = useState(false)
  const rows = useMemo(() => {
    let l = (q.data || []).filter((p) => (!cat || String(p.category_id) === cat) && p.name.toLowerCase().includes(search.toLowerCase()))
    if (sort === 'price-asc') l = [...l].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') l = [...l].sort((a, b) => b.price - a.price)
    if (sort === 'name') l = [...l].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    return l
  }, [q.data, search, cat, sort])
  async function remove() {
    setBusy(true)
    try { await api(`/products/${del.id}`, { method: 'DELETE' }); ctx.toast('Produit supprimé ✓'); setDel(null); q.reload() }
    catch (e) { ctx.toast(e.message, true); setDel(null) } finally { setBusy(false) }
  }
  return (
    <section className="ad-card">
      <Toolbar search={search} onSearch={(v) => { setSearch(v); setPage(1) }}>
        <select value={cat} onChange={(e) => { setCat(e.target.value); setPage(1) }} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>{(cats.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Trier">
          <option value="recent">Plus récentes</option><option value="name">Nom A-Z</option>
          <option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option>
        </select>
        {ctx.write && <button className="ad-btn sm" onClick={() => setEdit({})}>+ Ajouter une robe</button>}
      </Toolbar>
      <State q={q} empty="Aucune robe. Ajoutez la première.">
        {rows.length ? (
          <div className="ad-scroll">
            <table className="ad-table">
              <thead><tr><th>Robe</th><th>Catégorie</th><th>Prix</th>{ctx.write && <th />}</tr></thead>
              <tbody>
                {rows.slice((page - 1) * PAGE, page * PAGE).map((p) => (
                  <tr key={p.id}>
                    <td><div className="ad-prod">{p.image && <img src={mediaUrl(p.image)} alt="" />}<span>{p.name}</span></div></td>
                    <td>{p.category || '—'}</td><td>{p.price} TND</td>
                    {ctx.write && <td className="ad-act">
                      <button className="ad-btn ghost sm" onClick={() => setEdit(p)}>Modifier</button>
                      <button className="ad-btn danger-o sm" onClick={() => setDel(p)}>Supprimer</button>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="ad-empty">Aucun résultat.</div>}
        <Pager page={page} total={rows.length} onPage={setPage} />
      </State>
      {edit && <ProductForm product={edit.id ? edit : null} categories={cats.data || []} ctx={ctx} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(); cats.reload() }} />}
      {del && <Confirm text={`Supprimer définitivement « ${del.name} » ?`} busy={busy} onYes={remove} onNo={() => setDel(null)} />}
    </section>
  )
}

function Users({ ctx }) {
  const q = useData('/admin/users', ctx.onAuth)
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [target, setTarget] = useState(null)
  const rows = useMemo(() => (q.data || []).filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())), [q.data, search])
  async function toggle() {
    try { await api(`/admin/users/${target.id}/block`, { method: 'PATCH', body: { blocked: !target.blocked } }); ctx.toast('Accès mis à jour ✓'); q.reload() }
    catch (e) { ctx.toast(e.message, true) } finally { setTarget(null) }
  }
  return (
    <section className="ad-card">
      <Toolbar search={search} onSearch={(v) => { setSearch(v); setPage(1) }} />
      <State q={q} empty="Aucun compte client pour l’instant.">
        <div className="ad-scroll">
          <table className="ad-table">
            <thead><tr><th>Nom</th><th>Email</th><th>Ville</th><th>Inscrit le</th><th>Accès</th><th /></tr></thead>
            <tbody>
              {rows.slice((page - 1) * PAGE, page * PAGE).map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.email}</td><td>{u.city || '—'}</td><td>{fmt(u.created_at)}</td>
                  <td><span className={`ad-badge ${u.blocked ? 'no' : 'ok'}`}>{u.blocked ? 'Bloqué' : 'Actif'}</span></td>
                  <td><button className={`ad-btn sm ${u.blocked ? 'ghost' : 'danger-o'}`} onClick={() => setTarget(u)}>{u.blocked ? 'Débloquer' : 'Bloquer'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={rows.length} onPage={setPage} />
      </State>
      {target && <Confirm text={`${target.blocked ? 'Débloquer' : 'Bloquer'} le compte de ${target.name} ?`} onYes={toggle} onNo={() => setTarget(null)} />}
    </section>
  )
}

function Categories({ ctx }) {
  const q = useData('/categories', ctx.onAuth)
  const [name, setName] = useState(''); const [err, setErr] = useState('')
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null)
  const [busy, setBusy] = useState(false)
  const request = useRef(false)
  async function add(e) {
    e.preventDefault()
    if (request.current) return
    if (!name.trim() || name.trim().length > 80) return setErr('Nom requis, 80 caractères maximum.')
    request.current = true; setBusy(true)
    try { await api(edit ? `/categories/${edit.id}` : '/categories', { method: edit ? 'PUT' : 'POST', body: { name } }); setName(''); setEdit(null); setErr(''); ctx.toast('Catégorie enregistrée ✓'); q.reload() }
    catch (x) { setErr(x.message) }
    finally { request.current = false; setBusy(false) }
  }
  async function remove() {
    if (request.current) return
    request.current = true; setBusy(true)
    try { await api(`/categories/${del.id}`, { method: 'DELETE' }); setDel(null); setErr(''); q.reload(); ctx.toast('Catégorie supprimée ✓') }
    catch (error) { setErr(error.message) }
    finally { request.current = false; setBusy(false) }
  }
  return (
    <section className="ad-card">
      {ctx.write && (
        <form className="ad-toolbar" onSubmit={add} noValidate>
          <Field label="" error={!del ? err : ''}><input aria-label="Nom de catégorie" maxLength={80} disabled={busy} placeholder="Nouvelle catégorie" value={name} onChange={(e) => { setName(e.target.value); setErr('') }} /></Field>
          <button className="ad-btn sm" disabled={busy}>{busy ? 'Enregistrement…' : edit ? 'Enregistrer' : '+ Ajouter'}</button>
          {edit && <button type="button" className="ad-btn ghost sm" disabled={busy} onClick={() => { setEdit(null); setName(''); setErr('') }}>Annuler</button>}
        </form>
      )}
      <State q={q} empty="Aucune catégorie.">
        <div className="ad-scroll"><table className="ad-table"><thead><tr><th>Catégorie</th><th>Robes</th>{ctx.write && <th>Actions</th>}</tr></thead>
          <tbody>{(q.data || []).map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.products}</td>{ctx.write && <td className="ad-act"><button className="ad-btn ghost sm" disabled={busy} onClick={() => { setEdit(c); setName(c.name); setErr('') }}>Modifier</button>{' '}<button className="ad-btn danger-o sm" disabled={busy || c.products > 0} title={c.products ? 'Réaffectez les robes avant suppression.' : 'Supprimer la catégorie vide'} onClick={() => { setDel(c); setErr('') }}>Supprimer</button></td>}</tr>)}</tbody></table></div>
      </State>
      {del && <Confirm text={`Supprimer la catégorie « ${del.name} » ?`} onYes={remove} onNo={() => { setDel(null); setErr('') }} busy={busy} error={err} />}
    </section>
  )
}

function Messages({ ctx }) {
  const q = useData('/admin/messages', ctx.onAuth)
  const [search, setSearch] = useState('')
  const rows = (q.data || []).filter((m) => `${m.name} ${m.email} ${m.message}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <section className="ad-card">
      <Toolbar search={search} onSearch={setSearch}><button className="ad-btn ghost sm" onClick={q.reload} disabled={q.loading}>Actualiser</button></Toolbar>
      <State q={q} empty="Aucun message reçu pour l’instant.">
        <div className="ad-msgs">{rows.map((m) => (
          <article key={m.id}><header><b>{m.name}</b> · <a href={`mailto:${m.email}`}>{m.email}</a><time>{fmt(m.created_at)}</time></header><p>{m.message}</p></article>
        ))}</div>
        {!rows.length && <p className="ad-empty">Aucun message ne correspond à votre recherche.</p>}
      </State>
    </section>
  )
}

function Admins({ ctx }) {
  const q = useData('/admin/admins', ctx.onAuth)
  const [open, setOpen] = useState(false); const [del, setDel] = useState(null)
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'secondaire' }); const [err, setErr] = useState({})
  const [creating, setCreating] = useState(false); const [deleting, setDeleting] = useState(false)
  const [serverError, setServerError] = useState(''); const [deleteError, setDeleteError] = useState('')
  const [created, setCreated] = useState(null); const [showPassword, setShowPassword] = useState(false)
  const request = useRef(false)
  const blank = () => ({ name: '', email: '', password: '', role: 'secondaire' })
  const set = (k) => (e) => { setF((current) => ({ ...current, [k]: e.target.value })); setErr((current) => ({ ...current, [k]: '' })); setServerError('') }
  function openCreate() { setF(blank()); setErr({}); setServerError(''); setCreated(null); setShowPassword(false); setOpen(true) }
  function closeCreate() { if (!creating) { setOpen(false); setF(blank()); setShowPassword(false) } }
  async function create(e) {
    e.preventDefault()
    if (request.current) return
    const er = {}
    if (!f.name.trim() || f.name.trim().length > 100) er.name = 'Nom obligatoire, 100 caractères maximum.'
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim()) || f.email.trim().length > 150) er.email = 'Saisissez une adresse e-mail valide.'
    if (f.password.length < 10 || new TextEncoder().encode(f.password).length > 72) er.password = '10 caractères minimum, 72 octets maximum.'
    setErr(er); setServerError(''); if (Object.keys(er).length) return
    request.current = true; setCreating(true)
    try {
      const saved = await api('/admin/admins', { method: 'POST', body: { ...f, name: f.name.trim(), email: f.email.trim().toLowerCase() } })
      setCreated(saved); setOpen(false); setF(blank()); setShowPassword(false); q.reload()
    } catch (x) {
      setErr((current) => ({ ...current, ...x.details?.fields }))
      setServerError(x.status ? x.message : 'Création impossible. Vérifiez votre connexion et réessayez.')
    } finally { request.current = false; setCreating(false) }
  }
  async function remove() {
    if (request.current || !del) return
    request.current = true; setDeleting(true); setDeleteError('')
    try { await api(`/admin/admins/${del.id}`, { method: 'DELETE' }); ctx.toast('Administrateur supprimé ✓'); if (created?.id === del.id) setCreated(null); setDel(null); q.reload() }
    catch (x) { setDeleteError(x.status ? x.message : 'Suppression impossible. Vérifiez votre connexion et réessayez.') }
    finally { request.current = false; setDeleting(false) }
  }
  return (
    <section className="ad-card">
      <div className="ad-toolbar"><span className="ad-muted">L’adresse e-mail est l’identifiant de connexion de chaque administrateur.</span><button className="ad-btn sm" onClick={openCreate}>+ Nouvel administrateur</button><button className="ad-btn ghost sm" disabled={q.loading} onClick={q.reload}>Actualiser</button></div>
      {created && <div className="ad-admin-success" role="status"><strong>Compte administrateur créé : {created.email}</strong><p>Pour utiliser ce compte, déconnectez-vous puis ouvrez Connexion avec cette adresse e-mail et le mot de passe choisi.</p></div>}
      <State q={q} empty="Aucun administrateur trouvé.">
        <div className="ad-scroll"><table className="ad-table"><thead><tr><th>Nom</th><th>Adresse e-mail de connexion</th><th>Rôle</th><th>Actions</th></tr></thead>
          <tbody>{(q.data || []).map((a) => (
            <tr key={a.id}><td>{a.name}</td><td className="ad-admin-email" dir="ltr">{a.email}</td><td>{a.role === 'principal' ? 'Principal' : 'Secondaire'}</td>
              <td>{a.id === ctx.admin.id ? <span className="ad-muted">Votre compte</span> : <button className="ad-btn danger-o sm" onClick={() => { setDel(a); setDeleteError('') }}>Supprimer</button>}</td></tr>
          ))}</tbody></table></div>
      </State>
      {open && (
        <Modal title="Nouvel administrateur" onClose={closeCreate}>
          <form className="ad-form" onSubmit={create} noValidate autoComplete="off">
            {serverError && <p className="ad-admin-error" role="alert">{serverError}</p>}
            <fieldset className="ad-form-fields" disabled={creating}>
            <Field label="Nom de l’administrateur" error={err.name}><input id="new-admin-name" name="admin_name" type="text" autoComplete="name" maxLength={100} value={f.name} onChange={set('name')} /></Field>
            <Field label="Adresse e-mail de connexion" error={err.email}><input id="new-admin-email" name="admin_email" type="email" inputMode="email" autoComplete="username" maxLength={150} placeholder="prenom@vintagedress.tn" value={f.email} onChange={set('email')} /></Field>
            <p className="ad-note">Cette adresse e-mail sera utilisée sur la page Connexion.</p>
            <div className="ad-field"><label htmlFor="new-admin-password">Mot de passe du nouvel administrateur</label><div className="ad-password-control"><input id="new-admin-password" name="admin_new_password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} maxLength={72} placeholder="Choisissez un mot de passe" value={f.password} onChange={set('password')} aria-invalid={!!err.password} aria-describedby="new-admin-password-help" /><button type="button" className="ad-btn ghost sm" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword}>{showPassword ? 'Masquer' : 'Afficher'}</button></div><span id="new-admin-password-help" className="ad-note">10 caractères minimum. Conservez le mot de passe choisi pour vous connecter.</span>{err.password && <small role="alert">{err.password}</small>}</div>
            <Field label="Rôle" error={err.role}><select value={f.role} onChange={set('role')}><option value="secondaire">Secondaire — consultation</option><option value="principal">Principal — gestion complète</option></select></Field>
            <div className="ad-modal-actions"><button type="button" className="ad-btn ghost" onClick={closeCreate}>Annuler</button><button className="ad-btn" disabled={creating}>{creating ? 'Création en cours…' : 'Créer l’administrateur'}</button></div>
            </fieldset>
          </form>
        </Modal>
      )}
      {del && <Confirm text={`Supprimer le compte de ${del.name} (${del.email}) ? Il ne pourra plus se connecter.`} onYes={remove} onNo={() => { if (!deleting) setDel(null) }} busy={deleting} error={deleteError} />}
    </section>
  )
}

/* ---------- page ---------- */
export default function AdminDashboard() {
  const navigate = useNavigate()
  const admin = getAdmin()
  const [params, setParams] = useSearchParams()
  const view = NAV.find(([id, , permission]) => id === params.get('onglet') && can(admin, permission))?.[0] || 'dashboard'
  const [toast, setToast] = useState(null)
  const [menu, setMenu] = useState(false)

  const onAuth = useCallback(() => { adminLogout(); navigate('/admin/login') }, [navigate])
  if (!admin) return <Navigate to="/admin/login" replace />

  const ctx = {
    admin, onAuth, write: can(admin, 'products:write'),
    toast: (text, error = false) => { setToast({ text, error }); setTimeout(() => setToast(null), 3000) },
  }
  const go = (v) => { setParams(v === 'dashboard' ? {} : { onglet: v }); setMenu(false) }
  const views = { dashboard: <Stats ctx={ctx} go={go} />, products: <Products ctx={ctx} />, orders: <Orders ctx={ctx} />, users: <Users ctx={ctx} />, categories: <Categories ctx={ctx} />, messages: <Messages ctx={ctx} />, admins: <Admins ctx={ctx} /> }

  return (
    <div className="ad-app">
      <aside className={`ad-sidebar ${menu ? 'open' : ''}`}>
        <div className="ad-brand">Vintage Dress<small>Espace Administrateur</small></div>
        <nav>
          {NAV.filter(([, , r]) => can(admin, r)).map(([id, label]) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => go(id)}>{label}</button>
          ))}
        </nav>
        <button className="ad-logout" onClick={() => { adminLogout(); navigate('/admin/login') }}>Déconnexion</button>
      </aside>
      <div className="ad-content">
        <header className="ad-top">
          <button className="ad-burger" aria-label="Menu" onClick={() => setMenu((m) => !m)}>☰</button>
          <h1>{NAV.find((n) => n[0] === view)[1]}</h1>
          <div className="ad-who"><b>{admin.name}</b><span>{admin.role === 'principal' ? 'Administrateur principal' : 'Administrateur secondaire'}</span></div>
        </header>
        {views[view]}
      </div>
      {toast && <div className={`ad-toast ${toast.error ? 'err' : ''}`} role="status">{toast.text}</div>}
    </div>
  )
}
