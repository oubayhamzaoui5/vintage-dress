import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { afterLogin } from '../utils/checkout.js'
import { useCart } from '../context/CartContext.jsx'
import { login } from '../utils/auth.js'
import { useAuth } from '../context/AuthContext.jsx'

const emailOk = (v) => /^\S+@\S+\.\S+$/.test(v)

export default function Login() {
  const { status, session } = useAuth()
  const { showToast } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '', remember: false })
  const [errors, setErrors] = useState({})
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((er) => ({ ...er, [key]: '' }))
  }

  function validate() {
    const er = {}
    if (!emailOk(form.email.trim())) er.email = 'Saisissez une adresse email valide.'
    if (form.password.length < 6) er.password = 'Au moins 6 caractères.'
    setErrors(er)
    return Object.keys(er).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return
    setLoading(true)
    try {
      const result = await login(form.email, form.password, form.remember)
      showToast('Connexion réussie ✓')
      navigate(afterLogin(result.type, location.state), { replace: true })
    } catch (error) {
      setFormError(error.message === 'Failed to fetch' ? 'Connexion au serveur impossible. Réessayez.' : error.message)
    } finally { setLoading(false) }
  }

  if (status === 'checking') return <main className="container section" role="status">Vérification de votre session…</main>
  if (session) return <Navigate to={afterLogin(session.type, location.state)} replace />

  return (
    <main className="login-page">
      <div className="login-card">
        <aside className="login-side">
          <div className="login-brand">Vintage Dress</div>
          <div>
            <h2>Ravie de vous revoir</h2>
            <p>Retrouvez vos commandes, vos favoris et les nouvelles pièces vintage de la boutique.</p>
            <ul className="login-perks">
              <li>Suivi de vos commandes</li>
              <li>Panier et favoris sauvegardés</li>
              <li>Paiement plus rapide</li>
            </ul>
          </div>
        </aside>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h1>Connexion</h1>
          <p className="login-sub">Connectez-vous avec votre compte client ou administrateur.</p>

          {formError && <div className="l-alert" role="alert">{formError}</div>}

          <div className={`l-field ${errors.email ? 'invalid' : ''}`}>
            <label htmlFor="email">Adresse email</label>
            <div className="l-input">
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="exemple@mail.com"
                value={form.email}
                onChange={update('email')}
              />
            </div>
            {errors.email && <div className="l-err">{errors.email}</div>}
          </div>

          <div className={`l-field ${errors.password ? 'invalid' : ''}`}>
            <label htmlFor="password">Mot de passe</label>
            <div className="l-input has-toggle">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={update('password')}
              />
              <button
                type="button"
                className="toggle"
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            {errors.password && <div className="l-err">{errors.password}</div>}
          </div>

          <div className="l-row">
            <label>
              <input type="checkbox" checked={form.remember} onChange={update('remember')} />
              Se souvenir de moi
            </label>
            <Link to="/contact">Aide à la connexion</Link>
          </div>

          <button type="submit" className="l-submit" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

          <div className="l-divider">ou</div>

          <button type="button" className="l-google" disabled title="Connexion Google non configurée. Utilisez votre e-mail et votre mot de passe.">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/>
              <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
            </svg>
            Google · non disponible
          </button>

          <p className="l-switch">
            Pas encore de compte ? <Link to="/inscription" state={location.state}>Créer un compte</Link>
          </p>
        </form>
      </div>
    </main>
  )
}
