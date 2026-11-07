import { Link, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { RequireAuth, useAuth } from './context/AuthContext.jsx'
import { useCart } from './context/CartContext.jsx'
import Home from './pages/Home.jsx'
import Shop from './pages/Shop.jsx'
import About from './pages/About.jsx'
import Contact from './pages/Contact.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import OrderConfirmation from './pages/OrderConfirmation.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Account from './pages/Account.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

function StoreLayout() {
  const { session } = useAuth()
  const { cart } = useCart()
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  return <>
    <header className="site-header">
      <Link className="brand" to="/">Vintage Dress</Link>
      <nav aria-label="Navigation principale">
        <NavLink to="/" end>Accueil</NavLink><NavLink to="/boutique">Boutique</NavLink>
        <NavLink to="/a-propos">À propos</NavLink><NavLink to="/contact">Contact</NavLink>
        <NavLink to={session?.type === 'admin' ? '/admin' : session ? '/compte' : '/login'}>{session?.type === 'admin' ? 'Administration' : session ? 'Mon compte' : 'Connexion'}</NavLink><NavLink to="/panier">Panier ({count})</NavLink>
      </nav>
    </header>
    <Outlet />
    <footer className="site-footer"><span>Vintage Dress</span><Link to="/admin">Administration</Link></footer>
  </>
}

export default function App() {
  return <Routes>
    <Route element={<StoreLayout />}>
      <Route index element={<Home />} /><Route path="boutique" element={<Shop />} />
      <Route path="a-propos" element={<About />} /><Route path="about" element={<About />} />
      <Route path="contact" element={<Contact />} /><Route path="panier" element={<Cart />} />
      <Route path="login" element={<Login />} /><Route path="inscription" element={<Register />} />
      <Route element={<RequireAuth type="user" />}>
        <Route path="compte" element={<Account />} />
        <Route path="commande" element={<Checkout />} />
        <Route path="commandes/:id" element={<OrderConfirmation />} />
      </Route>
      <Route path="*" element={<main className="container section"><h1>Page introuvable</h1><Link to="/">Retour à l’accueil</Link></main>} />
    </Route>
    <Route path="admin/login" element={<Navigate to="/login" replace />} />
    <Route element={<RequireAuth type="admin" />}><Route path="admin" element={<AdminDashboard />} /></Route>
  </Routes>
}
