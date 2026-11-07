import { useState } from 'react'
import { Link } from 'react-router-dom'

// Place la photo de Rania dans  public/rania-attia.jpg  (ou change ce chemin)
const RANIA_PHOTO = '/rania-attia.jpg'

const shows = [
  {
    year: 'COLLECTION 1',
    title: 'Élégance des années 50',
    text: 'Tailles marquées, jupes amples et tissus fluides : le chic intemporel des grandes soirées.',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85',
  },
  {
    year: 'COLLECTION 2',
    title: 'Romantisme des années 70',
    text: 'Robes longues, imprimés fleuris et manches légères pour un style libre et poétique.',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=85',
  },
  {
    year: 'COLLECTION 3',
    title: 'Glamour rétro',
    text: 'Pièces de caractère et détails précieux, choisis pour les grandes occasions.',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85',
  },
]

const values = [
  ['✓', 'Qualité garantie', 'Chaque robe est vérifiée et remise en état.'],
  ['♻', 'Mode durable', 'Donner une seconde vie aux belles pièces.'],
  ['🚚', 'Livraison rapide', 'Expédition soignée partout en Tunisie.'],
  ['♡', 'Service client', 'Une équipe à votre écoute, avant et après l\'achat.'],
]

function LogoMark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill="#8f2f40" />
      <path
        d="M27 12h10l-1 9c4 3 9 9 11 31H17c2-22 7-28 11-31z"
        fill="#fff"
      />
      <path d="M27 12c1 4 9 4 10 0" fill="none" stroke="#8f2f40" strokeWidth="2" />
      <path d="M25 30h14" stroke="#8f2f40" strokeWidth="2" />
    </svg>
  )
}

export default function About() {
  const [photoOk, setPhotoOk] = useState(true)

  return (
    <main>
      <section className="ab-hero">
        <div className="ab-logo">
          <LogoMark />
          <b>Vintage Dress</b>
          <small>BOUTIQUE DE ROBES VINTAGE</small>
        </div>
        <h1>Une histoire de passion et d'élégance</h1>
        <p>
          Nous sélectionnons des robes vintage et des pièces uniques pour offrir à chaque femme
          une tenue pleine de caractère.
        </p>
      </section>

      <section className="ab-sec">
        <div className="container">
          <div className="ab-story">
            <div>
              <h2 className="ab-title">Notre histoire</h2>
              <p>
                Vintage Dress est née d'une passion pour la mode et l'élégance intemporelle. Chaque
                robe est choisie avec soin, pour son tissu, sa coupe et son histoire.
              </p>
              <h2 className="ab-title" style={{ fontSize: 26, marginTop: 26 }}>Notre mission</h2>
              <p>
                Redonner vie aux trésors du passé et proposer une expérience de shopping simple,
                élégante et accessible.
              </p>
            </div>
            <img
              src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=85"
              alt="Robe vintage de la boutique Vintage Dress"
            />
          </div>
        </div>
      </section>

      <section className="ab-sec alt">
        <div className="container">
          <h2 className="ab-title">Notre fondatrice</h2>
          <p className="ab-lead">La personne derrière la boutique et son administration.</p>
          <div className="ab-founder">
            <div className="ab-photo">
              RA
              {photoOk && (
                <img src={RANIA_PHOTO} alt="Rania Attia" onError={() => setPhotoOk(false)} />
              )}
            </div>
            <div>
              <h3>Rania Attia</h3>
              <div className="ab-role">Fondatrice &amp; Administratrice</div>
              <p>
                Passionnée de mode ancienne, Rania sélectionne elle-même chaque pièce de la
                boutique et gère l'ensemble de Vintage Dress : catalogue, commandes et relation avec
                les clientes.
              </p>
              <blockquote>« Une belle robe a toujours une histoire à raconter. »</blockquote>
              <div className="ab-contact">
                <span>contact@vintagedress.tn</span>
                <span>+216 99 123 456</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ab-sec">
        <div className="container">
          <h2 className="ab-title">Nos défilés de mode</h2>
          <p className="ab-lead">Trois collections présentées en défilé, pour retrouver l'esprit de chaque époque.</p>
          <div className="ab-shows">
            {shows.map((s) => (
              <article className="ab-show" key={s.title}>
                <img src={s.image} alt={s.title} loading="lazy" />
                <div>
                  <small>{s.year}</small>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="ab-sec alt">
        <div className="container">
          <h2 className="ab-title">Nos engagements</h2>
          <p className="ab-lead">Ce que vous pouvez attendre de nous à chaque commande.</p>
          <div className="ab-values">
            {values.map(([icon, title, text]) => (
              <div className="ab-value" key={title}>
                <i>{icon}</i><b>{title}</b><span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ab-cta">
        <h2>Trouvez votre prochaine robe</h2>
        <p>Des pièces uniques, sélectionnées avec passion.</p>
        <Link className="hero-btn" to="/boutique">Découvrir la collection →</Link>
      </section>
    </main>
  )
}
