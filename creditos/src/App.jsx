import { useState, useEffect } from 'react'
import { supabase, signInWithGoogle, signOut } from './lib/supabase'
import Venta from './pages/Venta'
import Creditos from './pages/Creditos'
import Deuda from './pages/Deuda'
import Inventario from './pages/Inventario'
import Exportar from './pages/Exportar'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('venta')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F10') { e.preventDefault(); setTab('venta') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--text2)', fontSize: 13 }}>Cargando...</span>
    </div>
  )

  if (!session) return <Login />

  const tabs = [
    { id: 'venta', label: 'Venta' },
    { id: 'creditos', label: 'Créditos' },
    { id: 'deuda', label: 'Deuda' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'exportar', label: 'Exportar' },
  ]

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-left">
          <span className="logo">CreditOS</span>
          <nav className="nav">
            {tabs.map(t => (
              <button key={t.id} className={`nav-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="topbar-right">
          <span className="user-name">{session.user.email}</span>
          <button className="btn-signout" onClick={signOut}>Salir</button>
        </div>
      </div>
      <div className="content">
        {tab === 'venta' && <Venta />}
        {tab === 'creditos' && <Creditos />}
        {tab === 'deuda' && <Deuda />}
        {tab === 'inventario' && <Inventario />}
        {tab === 'exportar' && <Exportar />}
      </div>
    </div>
  )
}

function Login() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">CreditOS</div>
        <div className="login-sub">Control de créditos y punto de venta</div>
        <button className="btn-google" onClick={signInWithGoogle}>
          <svg className="google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Entrar con Google
        </button>
      </div>
    </div>
  )
}
