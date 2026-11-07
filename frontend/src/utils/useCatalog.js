import { useEffect, useState } from 'react'
import { api, mediaUrl } from './api.js'

export function useCatalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api('/products', { auth: false })
      .then((rows) => { if (active) setProducts(rows.map((p) => ({ ...p, image: mediaUrl(p.image) }))) })
      .catch(() => { if (active) setError('Catalogue indisponible. Vérifiez que le serveur API est démarré, puis rechargez la page.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]
    .map((name) => ({ name, image: products.find((p) => p.category === name)?.image }))
  return { products, featuredProducts: products.slice(0, 6), categories, loading, error }
}
