import React, { useState, useEffect } from 'react'
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
  const [email, setEmail] = React.useState('')
  const [pass, setPass] = React.useState('')
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">CreditOS</div>
        <div className="login-sub">Control de créditos y punto de venta</div>
        <div className="inp-row"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
        <div className="inp-row"><label>Contraseña</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)}/></div>
        <button className="btn btn-p btn-f" onClick={async()=>{
          const {error} = await supabase.auth.signInWithPassword({email,password:pass})
          if(error) await supabase.auth.signUp({email,password:pass})
        }}>Entrar</button>
      </div>
    </div>
  )
}