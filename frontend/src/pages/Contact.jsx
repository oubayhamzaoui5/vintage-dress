import { useRef, useState } from 'react'
import { useCart } from '../context/CartContext.jsx'
import { api } from '../utils/api.js'

export default function Contact() {
  const { showToast } = useCart()
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const submitting = useRef(false)
  const change = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setError(''); setSuccess('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting.current) return
    const body = { name: form.name.trim(), email: form.email.trim(), message: form.message.trim() }
    if (!body.name || !body.message) { setError('Renseignez votre nom et votre message.'); return }
    submitting.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      await api('/messages', { method: 'POST', auth: false, body })
      setForm({ name: '', email: '', message: '' })
      setSuccess('Votre message a bien été envoyé à l’équipe Vintage Dress.')
      showToast('Message envoyé ✓')
    } catch (err) {
      setError(err.status ? err.message : 'Envoi impossible. Vérifiez votre connexion et réessayez. Votre message est conservé.')
    } finally { submitting.current = false; setBusy(false) }
  }

  return (
    <main className="container section">
      <div className="page-title">
        <h1>Contactez-nous</h1>
        <p>Nous serons ravis de répondre à vos questions.</p>
      </div>
      <div className="contact-grid" style={{ marginTop: 30 }}>
        <div className="contact-info">
          <h2 style={{ font: '30px Georgia' }}>Nos coordonnées</h2>
          <div className="contact-item">📍<strong>Adresse</strong>12 Rue de la Liberté, Tunis, Tunisie</div>
          <div className="contact-item">☎<strong>Téléphone</strong>+216 99 123 456</div>
          <div className="contact-item">✉<strong>Email</strong>contact@vintagedress.tn</div>
          <div className="contact-item">🕒<strong>Horaires</strong>Lun - Sam : 9h00 - 18h00</div>
        </div>
        <form className="contact-form form" style={{ padding: 30 }} onSubmit={handleSubmit}>
          <h2>Envoyer un message</h2>
          {error && <p role="alert" className="contact-error">{error}</p>}
          {success && <p role="status" className="contact-success">{success}</p>}
          <fieldset disabled={busy} className="contact-fields">
          <label htmlFor="contact-name">Nom complet</label>
          <input
            id="contact-name"
            autoComplete="name"
            maxLength={100}
            required
            placeholder="Votre nom"
            value={form.name}
            onChange={change('name')}
          />
          <label htmlFor="contact-email">Email</label>
          <input
            id="contact-email"
            autoComplete="email"
            maxLength={150}
            type="email"
            required
            placeholder="Votre email"
            value={form.email}
            onChange={change('email')}
          />
          <label htmlFor="contact-message">Message</label>
          <textarea
            id="contact-message"
            maxLength={3000}
            required
            placeholder="Votre message..."
            value={form.message}
            onChange={change('message')}
          />
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Envoi en cours…' : 'Envoyer le message'}</button>
          </fieldset>
        </form>
      </div>
    </main>
  )
}
