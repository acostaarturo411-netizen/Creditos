import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Deuda() {
  const [proveedores, setProveedores] = useState([])
  const [saldos, setSaldos] = useState({})
  const [detalle, setDetalle] = useState(null)
  const [compras, setCompras] = useState([])
  const [saldosCompra, setSaldosCompra] = useState({})
  const [abonos, setAbonos] = useState([])
  const [abonoForm, setAbonoForm] = useState(false)
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
  const [editandoProveedor, setEditandoProveedor] = useState(false)
  const [nombreEditProv, setNombreEditProv] = useState('')
  const [telEditProv, setTelEditProv] = useState('')
  const [editandoCompra, setEditandoCompra] = useState(null)
  const [compraForm, setCompraForm] = useState(false)
  const [nuevaCompraDesc, setNuevaCompraDesc] = useState('')
  const [nuevaCompraMonto, setNuevaCompraMonto] = useState('')
  const [nuevaCompraFecha, setNuevaCompraFecha] = useState(new Date().toISOString().split('T')[0])
  const [comprasSeleccionadas, setComprasSeleccionadas] = useState([])
  const [distribucion, setDistribucion] = useState({})
  const [modoDistribucion, setModoDistribucion] = useState('auto')

  useEffect(() => { loadProveedores() }, [])

  async function loadProveedores() {
    setLoading(true)
    const { data: provs } = await supabase.from('proveedores').select('*').order('nombre')
    if (!provs) { setLoading(false); return }
    const { data: compraData } = await supabase.from('compras_proveedores').select('proveedor_id, total')
    const { data: abonoData } = await supabase.from('abonos_proveedores').select('proveedor_id, monto')
    const mapa = {}
    provs.forEach(p => { mapa[p.id] = { compras: 0, abonado: 0 } })
    compraData?.forEach(c => { if (mapa[c.proveedor_id]) mapa[c.proveedor_id].compras += c.total })
    abonoData?.forEach(a => { if (mapa[a.proveedor_id]) mapa[a.proveedor_id].abonado += a.monto })
    setSaldos(mapa)
    setProveedores(provs)
    setLoading(false)
  }

  async function verDetalle(prov) {
    setDetalle(prov)
    setAbonoForm(false)
    setCompraForm(false)
    setEditandoProveedor(false)
    setEditandoCompra(null)
    setPeriodoTotal(null)
    setComprasSeleccionadas([])
    setDistribucion({})
    const { data: cs } = await supabase.from('compras_proveedores').select('*').eq('proveedor_id', prov.id).order('creado_en', { ascending: true })
    const { data: as } = await supabase.from('abonos_proveedores').select('*, abonos_proveedores_detalle(*)').eq('proveedor_id', prov.id).order('creado_en', { ascending: false })
    const { data: detalles } = await supabase.from('abonos_proveedores_detalle').select('compra_id, monto')
    const saldoMap = {}
    cs?.forEach(c => { saldoMap[c.id] = { total: c.total, abonado: 0 } })
    detalles?.forEach(d => { if (saldoMap[d.compra_id]) saldoMap[d.compra_id].abonado += d.monto })
    setSaldosCompra(saldoMap)
    setCompras(cs || [])
    setAbonos(as || [])
  }

  function getSaldoCompra(compraId) {
    const s = saldosCompra[compraId]
    if (!s) return 0
    return Math.max(0, s.total - s.abonado)
  }

  function toggleCompra(compraId) {
    setComprasSeleccionadas(prev => {
      if (prev.includes(compraId)) {
        const next = prev.filter(id => id !== compraId)
        setDistribucion(d => { const nd = { ...d }; delete nd[compraId]; return nd })
        return next
      }
      return [...prev, compraId]
    })
  }

  function distribuirAuto(monto) {
    const ordenadas = compras.filter(c => comprasSeleccionadas.includes(c.id) && getSaldoCompra(c.id) > 0)
      .sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
    let restante = parseFloat(monto) || 0
    const dist = {}
    for (const c of ordenadas) {
      const saldo = getSaldoCompra(c.id)
      const aplicar = Math.min(saldo, restante)
      if (aplicar > 0) dist[c.id] = aplicar.toFixed(2)
      restante -= aplicar
      if (restante <= 0) break
    }
    setDistribucion(dist)
  }

  function onMontoChange(val) {
    setMontoAbono(val)
    if (modoDistribucion === 'auto' && comprasSeleccionadas.length > 0) {
      distribuirAuto(val.replace(/[^0-9.]/g, ''))
    }
  }

  function onDistManual(compraId, val) {
    setDistribucion(prev => ({ ...prev, [compraId]: val }))
  }

  async function guardarNombreProveedor() {
    if (!nombreEditProv.trim()) return
    await supabase.from('proveedores').update({ nombre: nombreEditProv.trim(), telefono: telEditProv }).eq('id', detalle.id)
    setDetalle(prev => ({ ...prev, nombre: nombreEditProv.trim(), telefono: telEditProv }))
    setEditandoProveedor(false)
    loadProveedores()
  }

  async function guardarCompra() {
    const monto = parseFloat(nuevaCompraMonto.replace(/[^0-9.]/g, ''))
    if (!nuevaCompraDesc.trim() || !monto) return alert('Ingresa descripción y monto')
    const fecha = nuevaCompraFecha ? new Date(nuevaCompraFecha + 'T12:00:00').toISOString() : new Date().toISOString()
    await supabase.from('compras_proveedores').insert({ proveedor_id: detalle.id, descripcion: nuevaCompraDesc.trim(), total: monto, creado_en: fecha })
    setNuevaCompraDesc(''); setNuevaCompraMonto(''); setNuevaCompraFecha(new Date().toISOString().split('T')[0])
    setCompraForm(false)
    verDetalle(detalle)
    loadProveedores()
  }

  async function guardarEdicionCompra() {
    if (!editandoCompra) return
    const monto = parseFloat(String(editandoCompra.total).replace(/[^0-9.]/g, ''))
    if (!monto) return alert('Ingresa un monto válido')
    const fecha = editandoCompra.fecha_edit ? new Date(editandoCompra.fecha_edit + 'T12:00:00').toISOString() : editandoCompra.creado_en
    await supabase.from('compras_proveedores').update({ descripcion: editandoCompra.descripcion, total: monto, creado_en: fecha }).eq('id', editandoCompra.id)
    setEditandoCompra(null)
    verDetalle(detalle)
    loadProveedores()
  }

  async function eliminarCompra(id) {
    if (!confirm('¿Eliminar esta compra?')) return
    await supabase.from('compras_proveedores').delete().eq('id', id)
    verDetalle(detalle)
    loadProveedores()
  }

  async function subirFoto(file) {
    if (!file) return null
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `abonos-prov/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('evidencias').upload(path, file)
    setUploading(false)
    if (error) { alert('Error al subir foto'); return null }
    return path
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const path = await subirFoto(file)
    if (path) { setFotoUrl(path); setFotoLabel(`Foto lista: ${file.name}`); setFotoOk(true) }
  }

  async function agregarFotoAbono(abonoId, e) {
    const file = e.target.files?.[0]
    if (!file) return
    const path = await subirFoto(file)
    if (!path) return
    await supabase.from('abonos_proveedores').update({ foto_url: path }).eq('id', abonoId)
    verDetalle(detalle)
  }

  async function confirmarAbono() {
    const monto = parseFloat(montoAbono.replace(/[^0-9.]/g, ''))
    if (!monto || monto <= 0) return alert('Ingresa un monto válido')
    const { data: abono, error } = await supabase.from('abonos_proveedores').insert({
      proveedor_id: detalle.id,
      tipo: comprasSeleccionadas.length > 0 ? 'especifico' : 'general',
      forma_pago: formaPago,
      monto,
      foto_url: fotoUrl
    }).select().single()
    if (error) return alert('Error al guardar abono')
    if (comprasSeleccionadas.length > 0) {
      const detalles = Object.entries(distribucion)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([compra_id, v]) => ({ abono_id: abono.id, compra_id, monto: parseFloat(v) }))
      if (detalles.length > 0) await supabase.from('abonos_proveedores_detalle').insert(detalles)
    }
    setMontoAbono(''); setFotoUrl(null); setFotoLabel('+ Agregar foto de voucher'); setFotoOk(false)
    setComprasSeleccionadas([]); setDistribucion({})
    setAbonoForm(false)
    verDetalle(detalle)
    loadProveedores()
  }

  function calcPeriodo() {
    if (!fechaIni || !fechaFin) return
    const total = compras.filter(c => c.creado_en >= fechaIni && c.creado_en <= fechaFin + 'T23:59:59').reduce((s, c) => s + c.total, 0)
    setPeriodoTotal(total)
  }

  function getSaldo(id) {
    const s = saldos[id]
    if (!s) return 0
    return Math.max(0, s.compras - s.abonado)
  }

  const totalDeuda = proveedores.reduce((s, p) => s + getSaldo(p.id), 0)
  const totalAbonado = Object.values(saldos).reduce((s, v) => s + (v.abonado || 0), 0)
  const saldoActual = detalle ? (saldos[detalle.id]?.compras || 0) - (saldos[detalle.id]?.abonado || 0) : 0

  if (loading) return <div style={{ padding: 20, color: 'var(--text2)', fontSize: 13 }}>Cargando...</div>

  if (detalle) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => setDetalle(null)}>← Regresar</button>
        {!editandoProveedor ? (
          <>
            <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>{detalle.nombre}</span>
            <button className="btn btn-sm" onClick={() => { setNombreEditProv(detalle.nombre); setTelEditProv(detalle.telefono || ''); setEditandoProveedor(true) }}>Editar nombre</button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
            <input value={nombreEditProv} onChange={e => setNombreEditProv(e.target.value)} style={{ flex: 1, minWidth: 140 }} placeholder="Nombre del proveedor" />
            <input value={telEditProv} onChange={e => setTelEditProv(e.target.value)} style={{ width: 130 }} placeholder="Teléfono" />
            <button className="btn btn-sm" onClick={() => setEditandoProveedor(false)}>Cancelar</button>
            <button className="btn btn-p btn-sm" onClick={guardarNombreProveedor}>Guardar</button>
          </div>
        )}
      </div>

      <div className="metrics" style={{ marginBottom: 12 }}>
        <div className="met"><div className="met-l">Saldo pendiente</div><div className="met-v red">${Math.max(0, saldoActual).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
        <div className="met"><div className="met-l">Total comprado</div><div className="met-v">${(saldos[detalle.id]?.compras || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
        <div className="met"><div className="met-l">Total abonado</div><div className="met-v green">${(saldos[detalle.id]?.abonado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
      </div>

      <div className="periodo-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Total específico por periodo</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }} />
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>al</span>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }} />
            <button className="btn btn-p btn-sm" onClick={calcPeriodo}>Calcular</button>
          </div>
        </div>
        {periodoTotal !== null && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Total comprado en el periodo:</div>
            <div className="periodo-result-num">${periodoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div className="sec" style={{ margin: 0 }}>Compras a este proveedor</div>
        <button className="btn btn-sm btn-p" onClick={() => setCompraForm(v => !v)}>+ Registrar compra</button>
      </div>

      {compraForm && (
        <div className="abono-form" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nueva compra</div>
          <div className="inp-row"><label>Descripción</label><input value={nuevaCompraDesc} onChange={e => setNuevaCompraDesc(e.target.value)} placeholder="Ej: Tela seda natural..." /></div>
          <div className="g2">
            <div className="inp-row"><label>Monto total</label><input value={nuevaCompraMonto} onChange={e => setNuevaCompraMonto(e.target.value)} placeholder="0.00" /></div>
            <div className="inp-row"><label>Fecha de la compra</label><input type="date" value={nuevaCompraFecha} onChange={e => setNuevaCompraFecha(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setCompraForm(false)}>Cancelar</button>
            <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={guardarCompra}>Guardar compra</button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        {compras.length === 0 && <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text2)' }}>Sin compras registradas</div>}
        {compras.map(c => {
          const saldoC = getSaldoCompra(c.id)
          const liquidada = saldoC === 0 && (saldosCompra[c.id]?.abonado || 0) > 0
          return editandoCompra?.id === c.id ? (
            <div key={c.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <div className="inp-row"><label>Descripción</label><input value={editandoCompra.descripcion} onChange={e => setEditandoCompra(v => ({ ...v, descripcion: e.target.value }))} /></div>
              <div className="g2">
                <div className="inp-row"><label>Monto</label><input value={editandoCompra.total} onChange={e => setEditandoCompra(v => ({ ...v, total: e.target.value }))} /></div>
                <div className="inp-row"><label>Fecha</label><input type="date" value={editandoCompra.fecha_edit} onChange={e => setEditandoCompra(v => ({ ...v, fecha_edit: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => setEditandoCompra(null)}>Cancelar</button>
                <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={guardarEdicionCompra}>Guardar cambios</button>
              </div>
            </div>
          ) : (
            <div key={c.id} className="row no-hover" style={{ cursor: 'default', opacity: liquidada ? 0.7 : 1 }}>
              <div className="ri">
                <div className="rn" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {c.descripcion || 'Compra'}
                  {liquidada && <span style={{ background: '#14532d', color: '#4ade80', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>LIQUIDADA</span>}
                </div>
                <div className="rs">{new Date(c.creado_en).toLocaleDateString('es-MX')} · Total: ${c.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                {!liquidada && (saldosCompra[c.id]?.abonado || 0) > 0 && (
                  <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>
                    Abonado: ${(saldosCompra[c.id]?.abonado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} · Pendiente: ${saldoC.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {!liquidada && <div className="amt red">${saldoC.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>}
                <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--blue)', padding: '3px 8px' }} onClick={() => setEditandoCompra({ ...c, fecha_edit: c.creado_en.split('T')[0] })}>Editar</button>
                <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--red)', padding: '3px 8px' }} onClick={() => eliminarCompra(c.id)}>Eliminar</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="sec">Mis abonos a este proveedor</div>
      <div className="card" style={{ marginBottom: 8 }}>
        {abonos.length === 0 && <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text2)' }}>Sin abonos registrados</div>}
        {abonos.map(a => (
          <div key={a.id} className="row no-hover" style={{ cursor: 'default' }}>
            <div className={`abono-icon ${a.forma_pago === 'transferencia' ? 'ic-t' : a.forma_pago === 'efectivo' ? 'ic-e' : 'ic-d'}`}>
              {a.forma_pago === 'transferencia' ? '⇄' : a.forma_pago === 'efectivo' ? '$' : '↓'}
            </div>
            <div className="ri">
              <div className="rn">{a.forma_pago.charAt(0).toUpperCase() + a.forma_pago.slice(1)} <span className={`tag ${a.tipo === 'general' ? 'tag-gral' : 'tag-esp'}`}>{a.tipo === 'general' ? 'Al total' : 'Compras específicas'}</span></div>
              <div className="rs">{new Date(a.creado_en).toLocaleDateString('es-MX')} {new Date(a.creado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
              {a.abonos_proveedores_detalle?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  Distribuido en {a.abonos_proveedores_detalle.length} compra{a.abonos_proveedores_detalle.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <label className={`ev-thumb${a.foto_url ? ' has' : ''}`} title={a.foto_url ? 'Ver evidencia' : 'Agregar foto'}>
              {a.foto_url ? 'IMG' : '+'}
              {!a.foto_url && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => agregarFotoAbono(a.id, e)} />}
            </label>
            <div className="ra" style={{ marginLeft: 6 }}>
              <div className="amt green">+${a.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        ))}
      </div>

      {abonoForm && (
        <div className="abono-form">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Registrar abono</div>
          <div className="g2" style={{ marginBottom: 10 }}>
            <div className="inp-row">
              <label>Monto total del abono</label>
              <input value={montoAbono} onChange={e => onMontoChange(e.target.value)} placeholder="0.00" />
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

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
            Aplicar a compras (selecciona una o más)
          </div>
          <div style={{ marginBottom: 8, display: 'flex', gap: 6 }}>
            <button className={`btn btn-sm${modoDistribucion === 'auto' ? ' btn-p' : ''}`} onClick={() => { setModoDistribucion('auto'); distribuirAuto(montoAbono.replace(/[^0-9.]/g, '')) }}>Auto (más antigua primero)</button>
            <button className={`btn btn-sm${modoDistribucion === 'manual' ? ' btn-p' : ''}`} onClick={() => setModoDistribucion('manual')}>Manual</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {compras.filter(c => getSaldoCompra(c.id) > 0).map(c => (
              <div key={c.id} style={{ background: comprasSeleccionadas.includes(c.id) ? 'var(--blue-bg)' : 'var(--topbar)', borderRadius: 8, padding: '8px 12px', border: `1px solid ${comprasSeleccionadas.includes(c.id) ? 'rgba(96,165,250,0.3)' : 'var(--border-md)'}`, cursor: 'pointer' }}
                onClick={() => toggleCompra(c.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: comprasSeleccionadas.includes(c.id) ? 'var(--blue)' : 'var(--text)' }}>{c.descripcion}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{new Date(c.creado_en).toLocaleDateString('es-MX')} · Pendiente: ${getSaldoCompra(c.id).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${comprasSeleccionadas.includes(c.id) ? 'var(--blue)' : 'var(--border-md)'}`, background: comprasSeleccionadas.includes(c.id) ? 'var(--blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {comprasSeleccionadas.includes(c.id) && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </div>
                </div>
                {comprasSeleccionadas.includes(c.id) && modoDistribucion === 'manual' && (
                  <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                    <input value={distribucion[c.id] || ''} onChange={e => onDistManual(c.id, e.target.value)} placeholder="Monto a aplicar" style={{ fontSize: 13 }} />
                  </div>
                )}
                {comprasSeleccionadas.includes(c.id) && modoDistribucion === 'auto' && distribucion[c.id] && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                    Se aplicarán: ${parseFloat(distribucion[c.id]).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            ))}
            {compras.filter(c => getSaldoCompra(c.id) > 0).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text2)', padding: '8px 0' }}>Todas las compras están liquidadas</div>
            )}
          </div>

          <label className={`foto-upload${fotoOk ? ' ok' : ''}`}>
            {uploading ? 'Subiendo foto...' : fotoLabel}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
          </label>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>También puedes agregar la foto después</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => { setAbonoForm(false); setComprasSeleccionadas([]); setDistribucion({}) }}>Cancelar</button>
            <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={confirmarAbono} disabled={uploading}>
              {uploading ? 'Subiendo...' : 'Confirmar abono'}
            </button>
          </div>
        </div>
      )}
      <button className="btn btn-p btn-f" style={{ fontSize: 13 }} onClick={() => setAbonoForm(true)}>+ Registrar abono</button>
    </div>
  )

  return (
    <div>
      <div className="metrics">
        <div className="met"><div className="met-l">Total que debo</div><div className="met-v red">${totalDeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
        <div className="met"><div className="met-l">Proveedores</div><div className="met-v">{proveedores.length}</div></div>
        <div className="met"><div className="met-l">Abonado total</div><div className="met-v green">${totalAbonado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
      </div>
      <div className="sec">Mis proveedores</div>
      <div className="card">
        {proveedores.length === 0 && <div style={{ padding: '14px', fontSize: 13, color: 'var(--text2)' }}>Sin proveedores. Agrega el primero.</div>}
        {proveedores.map((p, i) => {
          const saldo = getSaldo(p.id)
          const colors = ['av-b','av-t','av-a','av-c','av-p']
          const initials = p.nombre.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
          return (
            <div key={p.id} className="row" onClick={() => verDetalle(p)}>
              <div className={`av ${colors[i % colors.length]}`}>{initials}</div>
              <div className="ri">
                <div className="rn">{p.nombre}</div>
                <div className="rs">{p.telefono || 'Sin teléfono'}</div>
              </div>
              <div className="ra">
                <div className="amt red">${saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                <div className="amt-l">pendiente</div>
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn btn-p btn-f" style={{ fontSize: 13 }} onClick={async () => {
        const nombre = prompt('Nombre del proveedor:')
        if (!nombre) return
        const tel = prompt('Teléfono (opcional):') || ''
        await supabase.from('proveedores').insert({ nombre, telefono: tel })
        loadProveedores()
      }}>+ Nuevo proveedor</button>
    </div>
  )
}
