import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Creditos() {
  const [clientes, setClientes] = useState([])
  const [saldos, setSaldos] = useState({})
  const [detalle, setDetalle] = useState(null)
  const [tickets, setTickets] = useState([])
  const [abonos, setAbonos] = useState([])
  const [abonoForm, setAbonoForm] = useState(false)
  const [tipoAbono, setTipoAbono] = useState('general')
  const [ticketEsp, setTicketEsp] = useState('')
  const [montoAbono, setMontoAbono] = useState('')
  const [formaPago, setFormaPago] = useState('transferencia')
  const [fotoUrl, setFotoUrl] = useState(null)
  const [fotoLabel, setFotoLabel] = useState('+ Agregar foto de voucher')
  const [fotoOk, setFotoOk] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fechaIni, setFechaIni] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [periodoTotal, setPeriodoTotal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadClientes() }, [])

  async function loadClientes() {
    setLoading(true)
    const { data: cls } = await supabase.from('clientes').select('*').order('nombre')
    if (!cls) { setLoading(false); return }
    const { data: tks } = await supabase.from('tickets').select('cliente_id, total, creado_en')
    const { data: abs } = await supabase.from('abonos_clientes').select('cliente_id, monto')
    const mapa = {}
    cls.forEach(c => { mapa[c.id] = { compras: 0, abonado: 0 } })
    tks?.forEach(t => { if (mapa[t.cliente_id]) mapa[t.cliente_id].compras += t.total })
    abs?.forEach(a => { if (mapa[a.cliente_id]) mapa[a.cliente_id].abonado += a.monto })
    setSaldos(mapa)
    setClientes(cls)
    setLoading(false)
  }

  async function verDetalle(cliente) {
    setDetalle(cliente)
    setAbonoForm(false)
    setPeriodoTotal(null)
    const { data: tks } = await supabase
      .from('tickets').select('*, ticket_items(*)')
      .eq('cliente_id', cliente.id).order('creado_en', { ascending: false })
    const { data: abs } = await supabase
      .from('abonos_clientes').select('*')
      .eq('cliente_id', cliente.id).order('creado_en', { ascending: false })
    setTickets(tks || [])
    setAbonos(abs || [])
  }

  async function subirFoto(file) {
    if (!file) return null
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `abonos/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('evidencias').upload(path, file)
    setUploading(false)
    if (error) { alert('Error al subir foto'); return null }
    return path
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const path = await subirFoto(file)
    if (path) {
      setFotoUrl(path)
      setFotoLabel(`Foto lista: ${file.name}`)
      setFotoOk(true)
    }
  }

  async function agregarFotoAbono(abonoId, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const path = await subirFoto(file)
    if (!path) return
    await supabase.from('abonos_clientes').update({ foto_url: path }).eq('id', abonoId)
    verDetalle(detalle)
  }

  async function confirmarAbono() {
    const monto = parseFloat(montoAbono.replace(/[^0-9.]/g, ''))
    if (!monto || monto <= 0) return alert('Ingresa un monto válido')
    await supabase.from('abonos_clientes').insert({
      cliente_id: detalle.id,
      ticket_id: tipoAbono === 'especifico' ? ticketEsp || null : null,
      tipo: tipoAbono,
      forma_pago: formaPago,
      monto,
      foto_url: fotoUrl
    })
    setMontoAbono(''); setFotoUrl(null); setFotoLabel('+ Agregar foto de voucher'); setFotoOk(false)
    setAbonoForm(false)
    verDetalle(detalle)
    loadClientes()
  }

  function calcPeriodo() {
    if (!fechaIni || !fechaFin) return
    const total = tickets
      .filter(t => t.creado_en >= fechaIni && t.creado_en <= fechaFin + 'T23:59:59')
      .reduce((s, t) => s + t.total, 0)
    setPeriodoTotal(total)
  }

  function getSaldoCliente(id) {
    const s = saldos[id]
    if (!s) return 0
    return Math.max(0, s.compras - s.abonado)
  }

  function ultimoAbono(id) {
    return null
  }

  const totalPorCobrar = clientes.reduce((s, c) => s + getSaldoCliente(c.id), 0)
  const totalAbonado = Object.values(saldos).reduce((s, v) => s + (v.abonado || 0), 0)

  const saldoActual = detalle ? (saldos[detalle.id]?.compras || 0) - (saldos[detalle.id]?.abonado || 0) : 0

  if (loading) return <div style={{ padding: 20, color: 'var(--text2)', fontSize: 13 }}>Cargando...</div>

  if (detalle) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={() => setDetalle(null)}>← Regresar</button>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{detalle.nombre}</span>
      </div>

      <div className="metrics" style={{ marginBottom: 12 }}>
        <div className="met"><div className="met-l">Saldo pendiente</div><div className="met-v red">${Math.max(0, saldoActual).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
        <div className="met"><div className="met-l">Total comprado</div><div className="met-v">${(saldos[detalle.id]?.compras || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
        <div className="met"><div className="met-l">Total abonado</div><div className="met-v green">${(saldos[detalle.id]?.abonado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
      </div>

      <div className="periodo-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Total específico por periodo</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }} />
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>al</span>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }} />
            <button className="btn btn-p btn-sm" onClick={calcPeriodo}>Calcular</button>
          </div>
        </div>
        {periodoTotal !== null && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>Total comprado en el periodo:</div>
            <div className="periodo-result-num">${periodoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
          </div>
        )}
      </div>

      <div className="sec">Compras a crédito</div>
      <div className="card" style={{ marginBottom: 12 }}>
        {tickets.length === 0 && <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text2)' }}>Sin compras registradas</div>}
        {tickets.map(t => (
          <div key={t.id} className="row no-hover" style={{ cursor: 'default' }}>
            <div className="ri">
              <div className="rn">#{t.numero} · {new Date(t.creado_en).toLocaleDateString('es-MX')}</div>
              <div className="rs">{t.ticket_items?.map(i => i.descripcion).join(', ')}</div>
            </div>
            <div className="ra">
              <div className="amt red" style={{ fontFamily: 'var(--mono)' }}>${t.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="sec">Abonos recibidos</div>
      <div className="card" style={{ marginBottom: 8 }}>
        {abonos.length === 0 && <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text2)' }}>Sin abonos registrados</div>}
        {abonos.map(a => (
          <div key={a.id} className="row no-hover" style={{ cursor: 'default' }}>
            <div className={`abono-icon ${a.forma_pago === 'transferencia' ? 'ic-t' : a.forma_pago === 'efectivo' ? 'ic-e' : 'ic-d'}`}>
              {a.forma_pago === 'transferencia' ? '⇄' : a.forma_pago === 'efectivo' ? '$' : '↓'}
            </div>
            <div className="ri">
              <div className="rn">{a.forma_pago.charAt(0).toUpperCase() + a.forma_pago.slice(1)} <span className={`tag ${a.tipo === 'general' ? 'tag-gral' : 'tag-esp'}`}>{a.tipo === 'general' ? 'Al total' : 'Compra esp.'}</span></div>
              <div className="rs">{new Date(a.creado_en).toLocaleDateString('es-MX')} {new Date(a.creado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <label className={`ev-thumb${a.foto_url ? ' has' : ''}`} title={a.foto_url ? 'Ver evidencia' : 'Agregar foto'}>
              {a.foto_url ? 'IMG' : '+'}
              {!a.foto_url && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => agregarFotoAbono(a.id, e)} />}
            </label>
            <div className="ra" style={{ marginLeft: 6 }}>
              <div className="amt green" style={{ fontFamily: 'var(--mono)' }}>+${a.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        ))}
      </div>

      {abonoForm && (
        <div className="abono-form">
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Registrar abono</div>
          <div className="inp-row">
            <label>Tipo de abono</label>
            <select value={tipoAbono} onChange={e => setTipoAbono(e.target.value)}>
              <option value="general">Al total general</option>
              <option value="especifico">A compra específica</option>
            </select>
          </div>
          {tipoAbono === 'especifico' && (
            <div className="inp-row">
              <label>Seleccionar compra</label>
              <select value={ticketEsp} onChange={e => setTicketEsp(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {tickets.map(t => <option key={t.id} value={t.id}>#{t.numero} · ${t.total.toLocaleString('es-MX')} · {new Date(t.creado_en).toLocaleDateString('es-MX')}</option>)}
              </select>
            </div>
          )}
          <div className="g2">
            <div className="inp-row">
              <label>Monto del abono</label>
              <input value={montoAbono} onChange={e => setMontoAbono(e.target.value)} placeholder="0.00" />
            </div>
            <div className="inp-row">
              <label>Forma de pago</label>
              <select value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="deposito">Depósito</option>
              </select>
            </div>
          </div>
          <label className={`foto-upload${fotoOk ? ' ok' : ''}`}>
            {uploading ? 'Subiendo foto...' : fotoLabel}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
          </label>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>También puedes agregar la foto después desde el historial</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setAbonoForm(false)}>Cancelar</button>
            <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={confirmarAbono} disabled={uploading}>
              {uploading ? 'Subiendo...' : 'Confirmar abono'}
            </button>
          </div>
        </div>
      )}

      <button className="btn btn-p btn-f" style={{ fontSize: 12 }} onClick={() => setAbonoForm(true)}>
        + Registrar abono
      </button>
    </div>
  )

  return (
    <div>
      <div className="metrics">
        <div className="met"><div className="met-l">Total por cobrar</div><div className="met-v red">${totalPorCobrar.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
        <div className="met"><div className="met-l">Clientes activos</div><div className="met-v">{clientes.length}</div></div>
        <div className="met"><div className="met-l">Cobrado total</div><div className="met-v green">${totalAbonado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
      </div>
      <div className="sec">Clientes con crédito</div>
      <div className="card">
        {clientes.length === 0 && <div style={{ padding: '14px', fontSize: 13, color: 'var(--text2)' }}>Sin clientes. Agrégalos desde aquí o en la pestaña de Créditos.</div>}
        {clientes.map((c, i) => {
          const saldo = getSaldoCliente(c.id)
          const colors = ['av-b','av-t','av-a','av-c','av-p']
          const initials = c.nombre.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
          return (
            <div key={c.id} className="row" onClick={() => verDetalle(c)}>
              <div className={`av ${colors[i % colors.length]}`}>{initials}</div>
              <div className="ri">
                <div className="rn">{c.nombre}</div>
                <div className="rs">{c.telefono || 'Sin teléfono'}</div>
              </div>
              <div className="ra">
                <div className="amt red" style={{ fontFamily: 'var(--mono)' }}>${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                <div className="amt-l">pendiente</div>
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn btn-p btn-f" style={{ fontSize: 12 }} onClick={() => {
        const nombre = prompt('Nombre del cliente:')
        if (!nombre) return
        const tel = prompt('Teléfono (opcional):') || ''
        supabase.from('clientes').insert({ nombre, telefono: tel }).then(loadClientes)
      }}>+ Nuevo cliente</button>
    </div>
  )
}
