import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function Venta() {
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [items, setItems] = useState([])
  const [buscadorOpen, setBuscadorOpen] = useState(false)
  const [busqQuery, setBusqQuery] = useState('')
  const [selProd, setSelProd] = useState(null)
  const [selIdx, setSelIdx] = useState(0)
  const [cantidad, setCantidad] = useState(1)
  const [precioEdit, setPrecioEdit] = useState('')
  const [ventasHoy, setVentasHoy] = useState([])
  const [mostrarVentas, setMostrarVentas] = useState(false)
  const [genericoOpen, setGenericoOpen] = useState(false)
  const [genDesc, setGenDesc] = useState('')
  const [genCant, setGenCant] = useState(1)
  const [genPrecio, setGenPrecio] = useState('')
  const [fase, setFase] = useState('buscar')
  const busqRef = useRef(null)
  const cantRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { loadClientes(); loadProductos(); loadVentasHoy() }, [])

  const prodsFiltrados = productos.filter(p => p.nombre.toLowerCase().includes(busqQuery.toLowerCase()))

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F10') { e.preventDefault(); abrirBuscador(); return }
      if (!buscadorOpen) return
      if (e.key === 'Escape') { cerrarBuscador(); return }
      if (fase === 'buscar') {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, prodsFiltrados.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)) }
        else if (e.key === 'Enter' && prodsFiltrados.length > 0) { e.preventDefault(); seleccionarProd(prodsFiltrados[selIdx]) }
      } else if (fase === 'cantidad') {
        if (e.key === 'Enter') { e.preventDefault(); agregarDesdeB() }
        if (e.key === 'Escape') { setFase('buscar'); setSelProd(null); setTimeout(() => busqRef.current?.focus(), 50) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [buscadorOpen, fase, selIdx, cantidad, precioEdit, prodsFiltrados])

  useEffect(() => { setSelIdx(0) }, [busqQuery])

  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('.prod-opt')
      if (items[selIdx]) items[selIdx].scrollIntoView({ block: 'nearest' })
    }
  }, [selIdx])

  async function loadClientes() {
    const { data } = await supabase.from('clientes').select('id,nombre').order('nombre')
    if (data) setClientes(data)
  }

  async function loadProductos() {
    const { data } = await supabase.from('productos').select('*').eq('activo', true).order('nombre')
    if (data) setProductos(data)
  }

  async function loadVentasHoy() {
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('tickets').select('*, clientes(nombre), ticket_items(*)').gte('creado_en', hoy).order('creado_en', { ascending: false })
    if (data) setVentasHoy(data)
  }

  function abrirBuscador() {
    setBuscadorOpen(true)
    setBusqQuery('')
    setSelProd(null)
    setSelIdx(0)
    setFase('buscar')
    setTimeout(() => busqRef.current?.focus(), 80)
  }

  function cerrarBuscador() {
    setBuscadorOpen(false)
    setSelProd(null)
    setFase('buscar')
  }

  function seleccionarProd(p) {
    setSelProd(p)
    setCantidad(1)
    setPrecioEdit(p.precio.toString())
    setFase('cantidad')
    setTimeout(() => cantRef.current?.focus(), 60)
  }

  function agregarDesdeB() {
    if (!selProd) return
    const cant = parseFloat(cantidad) || 1
    const precio = parseFloat(precioEdit) || selProd.precio
    const sub = cant * precio
    const unidadLabel = `${cant} ${selProd.unidad}${cant > 1 && !selProd.unidad.includes('media') ? 's' : ''}`
    setItems(prev => [...prev, {
      id: Date.now(),
      descripcion: selProd.nombre,
      cantidad: cant,
      unidad: selProd.unidad,
      precio_unitario: precio,
      subtotal: sub,
      label: `${unidadLabel} × $${precio.toLocaleString('es-MX')}`
    }])
    cerrarBuscador()
  }

  function agregarGenerico() {
    const cant = parseFloat(genCant) || 1
    const precio = parseFloat(genPrecio.replace(/[^0-9.]/g, '')) || 0
    if (!genDesc || !precio) return
    setItems(prev => [...prev, {
      id: Date.now(),
      descripcion: genDesc,
      cantidad: cant,
      unidad: 'pza',
      precio_unitario: precio,
      subtotal: cant * precio,
      label: `${cant} × $${precio.toLocaleString('es-MX')}`
    }])
    setGenDesc(''); setGenCant(1); setGenPrecio('')
    setGenericoOpen(false)
  }

  function quitarItem(id) { setItems(prev => prev.filter(i => i.id !== id)) }

  const total = items.reduce((s, i) => s + i.subtotal, 0)
  const totalHoy = ventasHoy.reduce((s, t) => s + t.total, 0)
  const clienteNombre = clientes.find(c => c.id === clienteId)?.nombre || ''

  async function confirmarVenta() {
    if (!clienteId || items.length === 0) return alert('Selecciona un cliente y agrega productos')
    const { data: ticket, error } = await supabase.from('tickets').insert({ cliente_id: clienteId, total }).select().single()
    if (error) return alert('Error al guardar: ' + error.message)
    const lineas = items.map(i => ({ ticket_id: ticket.id, descripcion: i.descripcion, cantidad: i.cantidad, unidad: i.unidad, precio_unitario: i.precio_unitario, subtotal: i.subtotal }))
    await supabase.from('ticket_items').insert(lineas)
    setItems([]); setClienteId('')
    loadVentasHoy()
    alert(`Ticket #${ticket.numero} guardado`)
  }

  const unidadBtns = {
    'caja': [[0.5,'Media caja'],[1,'1 caja'],[2,'2 cajas']],
    'pieza': [[1,'1 pieza'],[2,'2 piezas'],[5,'5 piezas']],
    'kilo': [[0.5,'500 gr'],[1,'1 kilo'],[2,'2 kilos']],
    'media caja': [[0.5,'½'],[1,'1'],[2,'2']],
  }

  return (
    <div>
      <div className="metrics">
        <div className="met"><div className="met-l">Ventas hoy</div><div className="met-v">{ventasHoy.length}</div></div>
        <div className="met"><div className="met-l">Total del día</div><div className="met-v green">${totalHoy.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div></div>
        <div className="met"><div className="met-l">Último ticket</div><div className="met-v">#{ventasHoy[0]?.numero || '—'}</div></div>
      </div>

      <div className="g2">
        <div>
          <div className="sec">Nuevo ticket</div>
          <div className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div className="inp-row">
              <label>Cliente</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
                <option value="">— Seleccionar cliente —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button className="btn btn-p" style={{ flex: 1, fontSize: 12 }} onClick={abrirBuscador}>
                Buscar producto <span className="kbd">F10</span>
              </button>
              <button className="btn" style={{ fontSize: 12 }} onClick={() => setGenericoOpen(v => !v)}>+ Genérico</button>
            </div>
            {genericoOpen && (
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius)', padding: 10, marginBottom: 8 }}>
                <div className="inp-row"><label>Descripción</label><input value={genDesc} onChange={e => setGenDesc(e.target.value)} placeholder="Artículo especial..." /></div>
                <div className="g2">
                  <div className="inp-row"><label>Cantidad</label><input type="number" value={genCant} onChange={e => setGenCant(e.target.value)} min="0.5" step="0.5" /></div>
                  <div className="inp-row"><label>Precio</label><input value={genPrecio} onChange={e => setGenPrecio(e.target.value)} placeholder="0.00" /></div>
                </div>
                <button className="btn btn-p btn-f btn-sm" onClick={agregarGenerico}>Agregar al ticket</button>
              </div>
            )}
          </div>
          <button className="btn btn-f" style={{ fontSize: 12, marginBottom: 8 }} onClick={() => setMostrarVentas(v => !v)}>
            {mostrarVentas ? 'Ocultar ventas del día' : `Ver ventas del día (${ventasHoy.length}) →`}
          </button>
          {mostrarVentas && (
            <div className="ventas-panel">
              {ventasHoy.length === 0 && <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text2)' }}>Sin ventas hoy</div>}
              {ventasHoy.map(v => (
                <div key={v.id} className="row no-hover" style={{ cursor: 'default' }}>
                  <div className="ri">
                    <div className="rn">#{v.numero} · {v.clientes?.nombre}</div>
                    <div className="rs">{v.ticket_items?.length} productos · {new Date(v.creado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="amt" style={{ fontFamily: 'var(--mono)' }}>${v.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="sec">Ticket activo</div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Nuevo ticket</span>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{clienteNombre || 'Sin cliente'}</span>
            </div>
            <div style={{ padding: '6px 14px', minHeight: 80 }}>
              {items.length === 0 && <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>Usa F10 para agregar productos</div>}
              {items.map(item => (
                <div key={item.id} className="ticket-item">
                  <div className="ti-desc">{item.descripcion}<div className="ti-unit">{item.label}</div></div>
                  <div className="ti-price">${item.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                  <div className="ti-del" onClick={() => quitarItem(item.id)}>×</div>
                </div>
              ))}
            </div>
            <div className="ticket-total">
              <span>Total a crédito</span>
              <span>${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="g2">
            <button className="btn btn-d btn-f" style={{ fontSize: 12 }} onClick={() => setItems([])}>Cancelar</button>
            <button className="btn btn-p btn-f" style={{ fontSize: 12 }} onClick={confirmarVenta}>Confirmar venta</button>
          </div>
        </div>
      </div>

      {buscadorOpen && (
        <div style={{ marginTop: 12 }}>
          <div className="buscador-overlay">
            <div className="buscador-modal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {fase === 'buscar' ? <>Buscar producto <span className="kbd">F10</span></> : <span style={{ color: 'var(--blue)' }}>{selProd?.nombre}</span>}
                </span>
                <button className="btn btn-sm" onClick={cerrarBuscador}>Cerrar <span className="kbd">Esc</span></button>
              </div>

              {fase === 'buscar' && (
                <>
                  <input ref={busqRef} value={busqQuery} onChange={e => setBusqQuery(e.target.value)} placeholder="Escribe para filtrar..." style={{ marginBottom: 8 }} />
                  <div className="prod-list" ref={listRef}>
                    {prodsFiltrados.map((p, i) => (
                      <div key={p.id} className={`prod-opt${i === selIdx ? ' sel' : ''}`} onClick={() => seleccionarProd(p)}>
                        <span><div className="po-name">{p.nombre}</div><div className="po-unit">{p.unidad}</div></span>
                        <span className="po-price">${p.precio.toLocaleString('es-MX')}</span>
                      </div>
                    ))}
                    {prodsFiltrados.length === 0 && <div style={{ padding: 10, fontSize: 12, color: 'var(--text2)' }}>Sin resultados</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>↑↓ navegar · Enter seleccionar · Esc cerrar</div>
                </>
              )}

              {fase === 'cantidad' && selProd && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                    ${selProd.precio.toLocaleString('es-MX')} / {selProd.unidad}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {(unidadBtns[selProd.unidad] || [[1,'1'],[2,'2'],[5,'5']]).map(([v, l]) => (
                      <button key={v} className="btn btn-sm" onClick={() => { setCantidad(v); cantRef.current?.focus() }}>{l}</button>
                    ))}
                  </div>
                  <div className="g2" style={{ marginBottom: 8 }}>
                    <div className="inp-row">
                      <label>Cantidad ({selProd.unidad})</label>
                      <input ref={cantRef} type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0.5" step="0.5" />
                    </div>
                    <div className="inp-row">
                      <label>Precio (modificable)</label>
                      <input value={precioEdit} onChange={e => setPrecioEdit(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
                    Subtotal: <strong style={{ color: 'var(--text)' }}>${(parseFloat(cantidad||0) * parseFloat(precioEdit||0)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Enter para agregar · Esc para regresar</div>
                  <button className="btn btn-p btn-f" onClick={agregarDesdeB}>Agregar al ticket</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
