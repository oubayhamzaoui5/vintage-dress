import { Link, useLocation, useParams } from 'react-router-dom'
import OrderDetails from '../components/OrderDetails.jsx'

export default function OrderConfirmation() {
  const { id } = useParams()
  const location = useLocation()
  return <main className="container section order-page">
    <h1>{location.state?.placed ? 'Commande confirmée' : `Commande #${id}`}</h1>
    {location.state?.placed && <p role="status">Votre commande a été enregistrée. Retrouvez son suivi dans votre compte.</p>}
    <OrderDetails id={id} />
    <p className="order-links"><Link className="btn" to="/compte?onglet=commandes">Mes commandes</Link><Link to="/boutique">Continuer mes achats</Link></p>
  </main>
}
