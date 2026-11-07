import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { afterLogin } from '../utils/checkout.js'
import { useCart } from '../context/CartContext.jsx'
import { register } from '../utils/auth.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { status, session } = useAuth()
  const { showToast } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => {
    setError('')
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères.')
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas.')
    setLoading(true)
    setError('')
    try {
      await register(form)
      showToast('Compte créé ✓')
      navigate(afterLogin('user', location.state), { replace: true })
    } catch (err) { setError(err.message === 'Failed to fetch' ? 'Connexion au serveur impossible. Réessayez.' : err.message) }
    finally { setLoading(false) }
  }

  if (status === 'checking') return <main className="container section" role="status">Vérification de votre session…</main>
  if (session) return <Navigate to={afterLogin(session.type, location.state)} replace />

  return (
    <main className="container section">
      <div className="auth">
        <div className="auth-photo" />
        <form className="form" onSubmit={handleSubmit}>
          <h1>Inscription</h1>
          <p style={{ color: '#777' }}>Créez votre compte Vintage Dress.</p>
          {error && <p role="alert" style={{ color: '#a1202f' }}>{error}</p>}
          <label htmlFor="r-name">Nom complet</label>
          <input id="r-name" required maxLength="100" autoComplete="name" placeholder="Votre nom" value={form.name} onChange={set('name')} />
          <label htmlFor="r-email">Email</label>
          <input id="r-email" type="email" required maxLength="150" autoComplete="email" placeholder="exemple@mail.com" value={form.email} onChange={set('email')} />
          <label htmlFor="r-pw">Mot de passe</label>
          <input id="r-pw" type="password" required minLength="6" autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={set('password')} />
          <label htmlFor="r-pw2">Confirmer le mot de passe</label>
          <input id="r-pw2" type="password" required autoComplete="new-password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} />
          <button className="btn full" type="submit" disabled={loading}>{loading ? 'Création du compte…' : 'Créer mon compte'}</button>
          <p style={{ textAlign: 'center', color: '#777' }}>
            Déjà un compte ? <Link to="/login" state={location.state} style={{ color: '#8f2f40' }}>Connexion</Link>
          </p>
        </form>
      </div>
    </main>
  )
}
