import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import ProductModal from '../components/ProductModal.jsx'
import { useCatalog } from '../utils/useCatalog.js'

export default function Shop() {
  const { products, loading, error } = useCatalog()
  const { addToCart } = useCart()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('default')
  const [selected, setSelected] = useState(null)
  const [params, setParams] = useSearchParams()
  const category = params.get('categorie') || ''

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    let list = products.filter(
      (p) => (!category || p.category === category) && (p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q))
    )
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    return list
  }, [products, query, sort, category])

  return (
    <main>
      <section className="hero" id="collection">
        <div>
          <p className="eyebrow">COLLECTION 2026</p>
          <h1>{products.length} robes pour votre style.</h1>
          <p>Élégance, vintage et modernité réunies dans une collection pensée pour chaque occasion.</p>
        </div>
      </section>

      <section className="container" id="boutique">
        <div className="shop-head">
          <div>
            <p className="eyebrow">VINTAGE DRESS</p>
            <h2>La boutique</h2>
            <span id="result-count">
              {filtered.length} robe{filtered.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="filters">
            {category && <button className="btn" onClick={() => setParams({})}>{category} · Voir tout</button>}
            <input
              id="search"
              type="search"
              aria-label="Rechercher une robe"
              placeholder="Rechercher une robe..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select id="sort" aria-label="Trier les robes" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="default">Trier par</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
              <option value="name">Nom A-Z</option>
            </select>
          </div>
        </div>

        <div id="productGrid" className="product-grid">
          {filtered.map((p, i) => (
            <article className="product-card" key={p.id} tabIndex={0} aria-label={`Détails : ${p.name}`} onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Enter') setSelected(p) }} onClick={() => setSelected(p)}>
              <div className="product-image">
                <img src={p.image} alt={p.name} loading="lazy" />
                {i < 4 && <span className="badge">NOUVEAU</span>}
                <button
                  className="quick-add"
                  disabled={p.stock === 0}
                  onClick={(e) => {
                    e.stopPropagation()
                    addToCart(p, 'M', 'Modèle présenté', 1)
                  }}
                >
                  {p.stock === 0 ? 'Rupture de stock' : '🛒 Ajouter au panier'}
                </button>
              </div>
              <div className="product-info">
                <span className="category">{p.category}</span>
                <h3>{p.name}</h3>
                <div className="price">{p.price} TND</div>
                <div className="rating">★★★★★ <span>(4.8)</span></div>
              </div>
            </article>
          ))}
        </div>
        {loading ? <p role="status">Chargement du catalogue…</p> : error ? <p role="alert">{error}</p> : filtered.length === 0 && <p className="empty">Aucune robe trouvée.</p>}
      </section>

      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </main>
  )
}
