import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Deuda() {
  const [proveedores, setProveedores] = useState([])
  const [saldos, setSaldos] = useState({})
  const [detalle, setDetalle] = useState(null)
  const [compras, setCompras] = useState([])
  const [saldosCompras, setSaldosCompras] = useState({})
  const [abonos, setAbonos] = useState([])
  const [abonoForm, setAbonoForm] = useState(false)
  const [editandoAbono, setEditandoAbono] = useState(null)
  const [tipoAbono, setTipoAbono] = useState('general')
  const [comprasSeleccionadas, setComprasSeleccionadas] = useState([])
  const [distribucion, setDistribucion] = useState({})
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
    setEditandoAbono(null)
    setPeriodoTotal(null)
    setComprasSeleccionadas([])
    setDistribucion({})
    await recargarDetalle(prov.id)
  }

  async function recargarDetalle(provId) {
    const id = provId || detalle?.id
    if (!id) return
    const { data: cs } = await supabase.from('compras_proveedores').select('*').eq('proveedor_id', id).order('creado_en', { ascending: true })
    const { data: as } = await supabase.from('abonos_proveedores').select('*, abonos_proveedores_detalle(*)').eq('proveedor_id', id).order('creado_en', { ascending: false })
    const { data: detalles } = await supabase.from('abonos_proveedores_detalle').select('compra_id, monto')
    const saldosPorCompra = {}
    cs?.forEach(c => { saldosPorCompra[c.id] = c.total })
    detalles?.forEach(d => { if (saldosPorCompra[d.compra_id] !== undefined) saldosPorCompra[d.compra_id] -= d.monto })
    setSaldosCompras(saldosPorCompra)
    setCompras(cs || [])
    setAbonos(as || [])
  }

  async function guardarNombreProveedor() {
    if (!nombreEditProv.trim()) return
    await supabase.from('proveedores').update({ nombre: nombreEditProv.trim(), telefono: telEditProv }).eq('id', detalle.id)
    setDetalle({ ...detalle, nombre: nombreEditProv.trim(), telefono: telEditProv })
    setEditandoProveedor(false)
    loadProveedores()
  }

  async function guardarCompra() {
    const monto = parseFloat(nuevaCompraMonto.replace(/[^0-9.]/g, ''))
    if (!nuevaCompraDesc.trim() || !monto) return alert('Ingresa descripción y monto')
    const fecha = new Date(nuevaCompraFecha + 'T12:00:00').toISOString()
    await supabase.from('compras_proveedores').insert({ proveedor_id: detalle.id, descripcion: nuevaCompraDesc.trim(), total: monto, creado_en: fecha })
    setNuevaCompraDesc(''); setNuevaCompraMonto(''); setNuevaCompraFecha(new Date().toISOString().split('T')[0])
    setCompraForm(false)
    await recargarDetalle()
    loadProveedores()
  }

  async function guardarEdicionCompra() {
    if (!editandoCompra) return
    const monto = parseFloat(String(editandoCompra.total).replace(/[^0-9.]/g, ''))
    if (!monto) return alert('Ingresa un monto válido')
    const fecha = new Date(editandoCompra.fecha_edit + 'T12:00:00').toISOString()
    await supabase.from('compras_proveedores').update({ descripcion: editandoCompra.descripcion, total: monto, creado_en: fecha }).eq('id', editandoCompra.id)
    setEditandoCompra(null)
    await recargarDetalle()
    loadProveedores()
  }

  async function eliminarCompra(id) {
    if (!confirm('¿Eliminar esta compra? También se eliminarán los abonos asociados a ella.')) return
    await supabase.from('abonos_proveedores_detalle').delete().eq('compra_id', id)
    const { error } = await supabase.from('compras_proveedores').delete().eq('id', id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    await recargarDetalle()
    loadProveedores()
  }

  async function eliminarAbono(abono) {
    if (!confirm('¿Eliminar este abono? El saldo se recalculará automáticamente.')) return
    await supabase.from('abonos_proveedores_detalle').delete().eq('abono_id', abono.id)
    await supabase.from('abonos_proveedores').delete().eq('id', abono.id)
    await recargarDetalle()
    loadProveedores()
  }

  async function guardarEdicionAbono() {
    if (!editandoAbono) return
    const monto = parseFloat(String(editandoAbono.monto).replace(/[^0-9.]/g, ''))
    if (!monto) return alert('Ingresa un monto válido')
    await supabase.from('abonos_proveedores').update({
      monto,
      forma_pago: editandoAbono.forma_pago,
    }).eq('id', editandoAbono.id)
    setEditandoAbono(null)
    await recargarDetalle()
    loadProveedores()
  }

  function toggleCompraSeleccionada(compra) {
    const ya = comprasSeleccionadas.find(c => c.id === compra.id)
    if (ya) {
      setComprasSeleccionadas(prev => prev.filter(c => c.id !== compra.id))
      setDistribucion(prev => { const n = { ...prev }; delete n[compra.id]; return n })
    } else {
      setComprasSeleccionadas(prev => [...prev, compra])
    }
  }

  function distribuirAutomatico(monto) {
    let restante = monto
    const nuevaDist = {}
    const ordenadas = [...comprasSeleccionadas].sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en))
    for (const c of ordenadas) {
      const saldo = Math.max(0, saldosCompras[c.id] || 0)
      const aplicar = Math.min(restante, saldo)
      nuevaDist[c.id] = aplicar.toFixed(2)
      restante -= aplicar
      if (restante <= 0) break
    }
    setDistribucion(nuevaDist)
  }

  function onMontoChange(val) {
    setMontoAbono(val)
    if (tipoAbono === 'multiple' && comprasSeleccionadas.length > 0) {
      const monto = parseFloat(val.replace(/[^0-9.]/g, '')) || 0
      distribuirAutomatico(monto)
    }
  }

  async function confirmarAbono() {
    const monto = parseFloat(montoAbono.replace(/[^0-9.]/g, ''))
    if (!monto || monto <= 0) return alert('Ingresa un monto válido')
    if (tipoAbono === 'multiple' && comprasSeleccionadas.length === 0) return alert('Selecciona al menos una compra')
    const { data: abono } = await supabase.from('abonos_proveedores').insert({
      proveedor_id: detalle.id,
      compra_id: null,
      tipo: tipoAbono,
      forma_pago: formaPago,
      monto,
      foto_url: fotoUrl
    }).select().single()
    if (tipoAbono === 'multiple' && abono) {
      const detalles = comprasSeleccionadas.map(c => ({
        abono_id: abono.id,
        compra_id: c.id,
        monto: parseFloat(distribucion[c.id] || 0)
      })).filter(d => d.monto > 0)
      if (detalles.length > 0) await supabase.from('abonos_proveedores_detalle').insert(detalles)
    }
    setMontoAbono(''); setFotoUrl(null); setFotoLabel('+ Agregar foto de voucher'); setFotoOk(false)
    setComprasSeleccionadas([]); setDistribucion({})
    setAbonoForm(false)
    await recargarDetalle()
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
    await recargarDetalle()
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
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>Total en el periodo:</div>
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
          const saldoC = saldosCompras[c.id] !== undefined ? saldosCompras[c.id] : c.total
          const liquidada = saldoC <= 0
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
            <div key={c.id} className="row no-hover" style={{ cursor: 'default', opacity: liquidada ? 0.75 : 1 }}>
              <div className="ri">
                <div className="rn" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {c.descripcion || 'Compra'}
                  {liquidada && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green)' }}>LIQUIDADA</span>}
                </div>
                <div className="rs">{new Date(c.creado_en).toLocaleDateString('es-MX')} · Total: ${c.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                {!liquidada && <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>Pendiente: ${Math.max(0, saldoC).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {liquidada ? <div className="amt green">$0.00</div> : <div className="amt red">${Math.max(0, saldoC).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>}
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
          editandoAbono?.id === a.id ? (
            <div key={a.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Editar abono</div>
              <div className="g2">
                <div className="inp-row"><label>Monto</label><input value={editandoAbono.monto} onChange={e => setEditandoAbono(v => ({ ...v, monto: e.target.value }))} /></div>
                <div className="inp-row">
                  <label>Forma de pago</label>
                  <select value={editandoAbono.forma_pago} onChange={e => setEditandoAbono(v => ({ ...v, forma_pago: e.target.value }))}>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="deposito">Depósito</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => setEditandoAbono(null)}>Cancelar</button>
                <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={guardarEdicionAbono}>Guardar cambios</button>
              </div>
            </div>
          ) : (
            <div key={a.id} className="row no-hover" style={{ cursor: 'default' }}>
              <div className={`abono-icon ${a.forma_pago === 'transferencia' ? 'ic-t' : a.forma_pago === 'efectivo' ? 'ic-e' : 'ic-d'}`}>
                {a.forma_pago === 'transferencia' ? '⇄' : a.forma_pago === 'efectivo' ? '$' : '↓'}
              </div>
              <div className="ri">
                <div className="rn">
                  {a.forma_pago.charAt(0).toUpperCase() + a.forma_pago.slice(1)}{' '}
                  <span className={`tag ${a.tipo === 'general' ? 'tag-gral' : 'tag-esp'}`}>
                    {a.tipo === 'general' ? 'Al total' : a.tipo === 'multiple' ? `${a.abonos_proveedores_detalle?.length || 0} compras` : 'Compra esp.'}
                  </span>
                </div>
                <div className="rs">{new Date(a.creado_en).toLocaleDateString('es-MX')} {new Date(a.creado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <label className={`ev-thumb${a.foto_url ? ' has' : ''}`} title={a.foto_url ? 'Ver evidencia' : 'Agregar foto'}>
                {a.foto_url ? 'IMG' : '+'}
                {!a.foto_url && <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => agregarFotoAbono(a.id, e)} />}
              </label>
              <div className="ra" style={{ marginLeft: 6 }}>
                <div className="amt green">+${a.monto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm" style={{ fontSize: 10, color: 'var(--blue)', padding: '2px 6px' }} onClick={() => setEditandoAbono({ ...a })}>Editar</button>
                  <button className="btn btn-sm" style={{ fontSize: 10, color: 'var(--red)', padding: '2px 6px' }} onClick={() => eliminarAbono(a)}>Eliminar</button>
                </div>
              </div>
            </div>
          )
        ))}
      </div>

      {abonoForm && (
        <div className="abono-form">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Registrar abono a proveedor</div>
          <div className="inp-row">
            <label>Tipo de abono</label>
            <select value={tipoAbono} onChange={e => { setTipoAbono(e.target.value); setComprasSeleccionadas([]); setDistribucion({}) }}>
              <option value="general">Al total general</option>
              <option value="multiple">A compras específicas</option>
            </select>
          </div>
          {tipoAbono === 'multiple' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Selecciona las compras</div>
              {compras.filter(c => (saldosCompras[c.id] || 0) > 0).map(c => {
                const sel = comprasSeleccionadas.find(x => x.id === c.id)
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: 4, background: sel ? 'var(--blue-bg)' : 'var(--topbar)', cursor: 'pointer', border: `1px solid ${sel ? 'rgba(96,165,250,0.3)' : 'var(--border-md)'}` }} onClick={() => toggleCompraSeleccionada(c)}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${sel ? 'var(--blue)' : 'var(--text2)'}`, background: sel ? 'var(--blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {sel && <span style={{ color: '#111', fontSize: 11, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.descripcion}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{new Date(c.creado_en).toLocaleDateString('es-MX')} · Pendiente: ${Math.max(0, saldosCompras[c.id] || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                )
              })}
              {comprasSeleccionadas.length > 0 && Object.keys(distribucion).length > 0 && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--topbar)', borderRadius: 8, border: '1px solid var(--border-md)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>Distribución (editable)</div>
                  {comprasSeleccionadas.sort((a, b) => new Date(a.creado_en) - new Date(b.creado_en)).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{c.descripcion}</div>
                      <input type="number" value={distribucion[c.id] || 0} onChange={e => setDistribucion(prev => ({ ...prev, [c.id]: e.target.value }))} style={{ width: 100, fontSize: 13 }} min="0" step="0.01" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="g2">
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
          <label className={`foto-upload${fotoOk ? ' ok' : ''}`}>
            {uploading ? 'Subiendo foto...' : fotoLabel}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFotoChange} />
          </label>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>También puedes agregar la foto después desde el historial</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => { setAbonoForm(false); setComprasSeleccionadas([]); setDistribucion({}) }}>Cancelar</button>
            <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={confirmarAbono} disabled={uploading}>
              {uploading ? 'Subiendo...' : 'Confirmar abono'}
            </button>
          </div>
        </div>
      )}
      <button className="btn btn-p btn-f" style={{ fontSize: 13 }} onClick={() => { setAbonoForm(true); setEditandoAbono(null) }}>+ Registrar abono</button>
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
