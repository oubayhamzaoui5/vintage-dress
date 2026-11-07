import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useCatalog } from '../utils/useCatalog.js'

// Remplace ces images par tes propres bannières (format large ~1700x540)
const slides = [
  {
    alt: 'Vintage Dress - Des robes vintage pour toutes vos occasions',
    image:
      'https://img.freepik.com/photos-premium/portrait-tres-belle-jeune-femme-marchant-dans-elegante-robe-ideale-pour-publicite_321315-2699.jpg',
  },
  {
    alt: 'Nouveautés robes vintage',
    image:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85',
  },
  {
    alt: 'Seconde main élégante',
    image:
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1800&q=85',
  },
]

export default function Home() {
  const { featuredProducts, categories, loading, error } = useCatalog()
  const { addToCart } = useCart()
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)

  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length)
  const next = () => setCurrent((c) => (c + 1) % slides.length)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000)
    return () => clearInterval(id)
  }, [paused])

  return (
    <>
      <section
        className="slider"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="slider-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {slides.map((s) => (
            <Link className="slide" to="/boutique" key={s.image}>
              <img src={s.image} alt={s.alt} onError={(e) => { e.currentTarget.hidden = true }} />
              <span className="slide-title">{s.alt}</span>
              <span className="slide-btn">Découvrez</span>
            </Link>
          ))}
        </div>

        <button className="slider-arrow left" onClick={prev} aria-label="Précédent">
          <svg viewBox="0 0 26 40"><polyline points="20,4 6,20 20,36" /></svg>
        </button>
        <button className="slider-arrow right" onClick={next} aria-label="Suivant">
          <svg viewBox="0 0 26 40"><polyline points="6,4 20,20 6,36" /></svg>
        </button>

        <div className="slider-dots">
          {slides.map((s, i) => (
            <button
              key={s.image}
              className={i === current ? 'active' : ''}
              onClick={() => setCurrent(i)}
              aria-label={`Bannière ${i + 1}`}
            />
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '48px 0' }}>
        <h2 className="shop-head-title">Nos catégories</h2>
        <div className="categories">
          {categories.map((c) => (
            <Link className="category-card" to={`/boutique?categorie=${encodeURIComponent(c.name)}`} key={c.name}>
              <img src={c.image} alt={c.name} />
              <b>{c.name}</b>
            </Link>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '0 0 48px' }}>
        <h2 className="shop-head-title">Produits en vedette</h2>
        <div className="product-grid">
          {featuredProducts.map((p) => (
            <article className="product-card" key={p.name}>
              <div className="product-image">
                <img src={p.image} alt={p.name} loading="lazy" />
                <button className="quick-add" disabled={p.stock === 0} onClick={() => addToCart(p, p.size)}>
                  {p.stock === 0 ? 'Rupture de stock' : '🛒 Ajouter au panier'}
                </button>
              </div>
              <div className="product-info">
                <h3>{p.name}</h3>
                <div className="price">{p.price} TND</div>
              </div>
            </article>
          ))}
        </div>
        {loading ? <p role="status">Chargement du catalogue…</p> : error ? <p role="alert">{error}</p> : featuredProducts.length === 0 && <p className="empty">Aucun produit disponible pour le moment.</p>}
      </section>
    </>
  )
}
