import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { imprimirTicketVenta, generarVistaPrevia } from '../lib/ticketPDF'

const ANCHO = 32
function linea(c = '-') { return c.repeat(ANCHO) }
function dosCol(iz, de) { return iz + ' '.repeat(Math.max(1, ANCHO - iz.length - de.length)) + de }
function truncar(t, max) { return t && t.length > max ? t.slice(0, max - 1) + '.' : (t || '') }

function generarLineasTicket(config, titulo, nombre, compras, abonos, totalComprado, totalAbonado, saldo) {
  const fecha = new Date().toLocaleDateString('es-MX')
  const lineas = []
  lineas.push({ t: 'titulo', v: config.nombre_negocio || 'CREDITOS' })
  if (config.slogan) lineas.push({ t: 'sub', v: config.slogan })
  if (config.telefono) lineas.push({ t: 'sub', v: config.telefono })
  lineas.push({ t: 'sep' })
  lineas.push({ t: 'bold', v: nombre })
  lineas.push({ t: 'small', v: titulo })
  lineas.push({ t: 'small', v: `Emitido: ${fecha}` })
  lineas.push({ t: 'sep' })
  lineas.push({ t: 'bold', v: 'COMPRAS:' })
  compras.forEach(c => {
    const f = new Date(c.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
    const desc = truncar(c.descripcion || 'Compra', 18)
    const monto = `$${parseFloat(c.total).toLocaleString('es-MX')}`
    lineas.push({ t: 'fila', iz: `${f} ${desc}`, de: monto })
  })
  lineas.push({ t: 'sep' })
  lineas.push({ t: 'fila', iz: 'TOTAL COMPRADO:', de: `$${totalComprado.toLocaleString('es-MX')}`, bold: true })
  lineas.push({ t: 'sep' })
  lineas.push({ t: 'bold', v: 'ABONOS:' })
  abonos.forEach(a => {
    const f = new Date(a.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
    const tipo = a.forma_pago === 'transferencia' ? 'Transfer.' : a.forma_pago === 'efectivo' ? 'Efectivo' : 'Deposito'
    const monto = `$${parseFloat(a.monto).toLocaleString('es-MX')}`
    lineas.push({ t: 'fila', iz: `${f} ${tipo}`, de: monto })
  })
  lineas.push({ t: 'sep' })
  lineas.push({ t: 'fila', iz: 'TOTAL ABONADO:', de: `$${totalAbonado.toLocaleString('es-MX')}`, bold: true })
  lineas.push({ t: 'sep2' })
  lineas.push({ t: 'fila', iz: 'SALDO PENDIENTE:', de: `$${saldo.toLocaleString('es-MX')}`, bold: true, grande: true })
  lineas.push({ t: 'sep2' })
  if (config.pie) lineas.push({ t: 'centro', v: config.pie })
  return lineas
}

async function imprimirConcentradoPDF(lineas, nombreArchivo, logoBase64, config) {
  const { jsPDF } = await import('jspdf')
  const mm = config.ancho === '80' ? 80 : 58
  const doc = new jsPDF({ unit: 'mm', format: [mm, 297], orientation: 'portrait' })
  const ancho = mm - 4
  const margen = 2
  let y = 6
  const fs = parseFloat(config.font_size) || (mm === 80 ? 8 : 7)
  const lh = fs * 0.35

  doc.setFont('courier', 'normal')

  if (logoBase64) {
    try {
      const tipo = String(logoBase64).startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(logoBase64, tipo, margen + (mm === 80 ? 10 : 4), y, mm === 80 ? 60 : 46, 16); y += 19
    } catch(e) {}
  }

  for (const l of lineas) {
    if (l.t === 'titulo') {
      doc.setFontSize(fs+3); doc.setFont('courier', 'bold')
      doc.text(l.v, (mm/2)+margen, y, { align: 'center' }); y += lh + 1
      doc.setFont('courier', 'normal'); doc.setFontSize(fs)
    } else if (l.t === 'sub' || l.t === 'centro') {
      doc.setFontSize(fs); doc.setFont('courier', 'normal')
      doc.text(l.v, (mm/2)+margen, y, { align: 'center' }); y += lh
    } else if (l.t === 'sep') {
      doc.setFontSize(fs); doc.text('-'.repeat(Math.floor(ancho/1.8)), margen, y); y += lh
    } else if (l.t === 'sep2') {
      doc.setFontSize(fs); doc.text('='.repeat(Math.floor(ancho/1.8)), margen, y); y += lh
    } else if (l.t === 'bold') {
      doc.setFontSize(fs+0.5); doc.setFont('courier', 'bold')
      doc.text(l.v, margen, y); y += lh
      doc.setFont('courier', 'normal'); doc.setFontSize(fs)
    } else if (l.t === 'small') {
      doc.setFontSize(fs-0.5); doc.setFont('courier', 'normal')
      doc.text(l.v, margen, y); y += lh - 0.3
    } else if (l.t === 'fila') {
      doc.setFontSize(l.grande ? fs+1 : fs)
      if (l.bold) doc.setFont('courier', 'bold'); else doc.setFont('courier', 'normal')
      doc.text(l.iz, margen, y)
      doc.text(l.de, mm - margen, y, { align: 'right' }); y += lh
    }
    if (y > doc.internal.pageSize.getHeight() - 10) { doc.addPage([mm, 297]); y = 6 }
  }
  doc.save(`${nombreArchivo}.pdf`)
}

export default function Exportar() {
  const [clientes, setClientes] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modo, setModo] = useState(null)
  const [seleccion, setSeleccion] = useState('')
  const [exportando, setExportando] = useState(false)
  const [incluirLiquidadas, setIncluirLiquidadas] = useState(false)
  const [listo, setListo] = useState(false)
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [config, setConfig] = useState({
    nombre_negocio: '', slogan: '', pie: '', telefono: '',
    logo: null, font_size: 8, ancho: '58', interlineado: 0.35,
    margen_izq: 2, margen_der: 2, margen_sup: 2,
    logo_ancho: 48, logo_alto: 13, logo_align: 'centro', logo_en_copia: false,
    alto_max: 280, modo_impresion: 'rapido', mostrar_unidad: false
  })
  const [logoPreview, setLogoPreview] = useState(null)
  const [previewUri, setPreviewUri] = useState(null)

  useEffect(() => {
    supabase.from('clientes').select('id,nombre').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('proveedores').select('id,nombre').order('nombre').then(({ data }) => { setProveedores(data || []); setCargando(false) })
    try {
      const saved = localStorage.getItem('ticket_config')
      if (saved) { const c = JSON.parse(saved); setConfig(prev => ({ ...prev, ...c })); if (c.logo) setLogoPreview(c.logo) }
    } catch(e) {}
  }, [])

  // Vista previa en vivo: se regenera sola al cambiar cualquier medida
  useEffect(() => {
    if (!configOpen) return
    const t = setTimeout(async () => {
      try { setPreviewUri(await generarVistaPrevia(config)) } catch (e) { console.warn('Preview:', e) }
    }, 450)
    return () => clearTimeout(t)
  }, [JSON.stringify(config), configOpen])

  function guardarConfig() {
    try { localStorage.setItem('ticket_config', JSON.stringify(config)) } catch(e) {}
    setConfigOpen(false)
    alert('Configuración guardada')
  }

  function handleLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const base64 = ev.target.result
      setLogoPreview(base64)
      setConfig(v => ({ ...v, logo: base64 }))
    }
    reader.readAsDataURL(file)
  }

  async function exportarCliente() {
    if (!seleccion) return alert('Selecciona un cliente')
    setExportando(true)
    const cliente = clientes.find(c => c.id === seleccion)
    const { data: tickets } = await supabase.from('tickets').select('*, ticket_items(*)').eq('cliente_id', seleccion).order('creado_en', { ascending: true })
    const { data: abonosData } = await supabase.from('abonos_clientes').select('*').eq('cliente_id', seleccion).order('creado_en', { ascending: true })
    const { data: detalles } = await supabase.from('abonos_clientes_detalle').select('ticket_id, monto')
    const saldosPorTicket = {}
    tickets?.forEach(t => { saldosPorTicket[t.id] = t.total })
    detalles?.forEach(d => { if (saldosPorTicket[d.ticket_id] !== undefined) saldosPorTicket[d.ticket_id] -= d.monto })
    const comprasFiltradas = (tickets || []).filter(t => {
      const saldo = saldosPorTicket[t.id] !== undefined ? saldosPorTicket[t.id] : t.total
      return incluirLiquidadas ? true : saldo > 0
    }).map(t => ({ ...t, descripcion: t.ticket_items?.map(i => i.descripcion).join(', ') }))
    const totalComprado = comprasFiltradas.reduce((s, t) => s + t.total, 0)
    const totalAbonado = (abonosData || []).reduce((s, a) => s + a.monto, 0)
    const saldo = Math.max(0, totalComprado - totalAbonado)
    const lineas = generarLineasTicket(config, 'CLIENTE', cliente.nombre, comprasFiltradas, abonosData || [], totalComprado, totalAbonado, saldo)
    await imprimirConcentradoPDF(lineas, `CreditOS_Cliente_${cliente.nombre.replace(/\s/g,'_')}`, config.logo, config)
    setExportando(false)
  }

  async function exportarProveedor() {
    if (!seleccion) return alert('Selecciona un proveedor')
    setExportando(true)
    const proveedor = proveedores.find(p => p.id === seleccion)
    const { data: compras } = await supabase.from('compras_proveedores').select('*').eq('proveedor_id', seleccion).order('creado_en', { ascending: true })
    const { data: abonosData } = await supabase.from('abonos_proveedores').select('*').eq('proveedor_id', seleccion).order('creado_en', { ascending: true })
    const { data: detalles } = await supabase.from('abonos_proveedores_detalle').select('compra_id, monto')
    const saldosPorCompra = {}
    compras?.forEach(c => { saldosPorCompra[c.id] = c.total })
    detalles?.forEach(d => { if (saldosPorCompra[d.compra_id] !== undefined) saldosPorCompra[d.compra_id] -= d.monto })
    const comprasFiltradas = (compras || []).filter(c => {
      const saldo = saldosPorCompra[c.id] !== undefined ? saldosPorCompra[c.id] : c.total
      return incluirLiquidadas ? true : saldo > 0
    })
    const totalComprado = comprasFiltradas.reduce((s, c) => s + c.total, 0)
    const totalAbonado = (abonosData || []).reduce((s, a) => s + a.monto, 0)
    const saldo = Math.max(0, totalComprado - totalAbonado)
    const lineas = generarLineasTicket(config, 'PROVEEDOR', proveedor.nombre, comprasFiltradas, abonosData || [], totalComprado, totalAbonado, saldo)
    await imprimirConcentradoPDF(lineas, `CreditOS_Proveedor_${proveedor.nombre.replace(/\s/g,'_')}`, config.logo, config)
    setExportando(false)
  }

  async function exportarTodo() {
    setExportando(true); setListo(false)
    try {
      const { data: clientesD } = await supabase.from('clientes').select('*')
      const { data: proveedoresD } = await supabase.from('proveedores').select('*')
      const { data: tickets } = await supabase.from('tickets').select('*, ticket_items(*), clientes(nombre)')
      const { data: abonosClientes } = await supabase.from('abonos_clientes').select('*, clientes(nombre)')
      const { data: comprasProv } = await supabase.from('compras_proveedores').select('*, proveedores(nombre)')
      const { data: abonosProv } = await supabase.from('abonos_proveedores').select('*, proveedores(nombre)')
      const { data: productos } = await supabase.from('productos').select('*')
      const now = new Date()
      const fechaStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      let csv = 'CREDITÓS — EXPORTACIÓN COMPLETA\n'
      csv += `Fecha: ${now.toLocaleDateString('es-MX')}\n\n`
      csv += '=== CLIENTES ===\nNombre,Teléfono,Registrado\n'
      clientesD?.forEach(c => { csv += `"${c.nombre}","${c.telefono||''}","${new Date(c.creado_en).toLocaleDateString('es-MX')}"\n` })
      csv += '\n=== TICKETS DE VENTA ===\nTicket#,Cliente,Total,Fecha,Productos\n'
      tickets?.forEach(t => { csv += `"${t.numero}","${t.clientes?.nombre}","${t.total}","${new Date(t.creado_en).toLocaleDateString('es-MX')}","${t.ticket_items?.map(i=>i.descripcion).join(' | ')}"\n` })
      csv += '\n=== ABONOS DE CLIENTES ===\nCliente,Monto,Tipo,Forma de pago,Fecha\n'
      abonosClientes?.forEach(a => { csv += `"${a.clientes?.nombre}","${a.monto}","${a.tipo}","${a.forma_pago}","${new Date(a.creado_en).toLocaleDateString('es-MX')}"\n` })
      csv += '\n=== PROVEEDORES ===\nNombre,Teléfono,Registrado\n'
      proveedoresD?.forEach(p => { csv += `"${p.nombre}","${p.telefono||''}","${new Date(p.creado_en).toLocaleDateString('es-MX')}"\n` })
      csv += '\n=== COMPRAS A PROVEEDORES ===\nProveedor,Descripción,Total,Fecha\n'
      comprasProv?.forEach(c => { csv += `"${c.proveedores?.nombre}","${c.descripcion||''}","${c.total}","${new Date(c.creado_en).toLocaleDateString('es-MX')}"\n` })
      csv += '\n=== ABONOS A PROVEEDORES ===\nProveedor,Monto,Tipo,Forma de pago,Fecha\n'
      abonosProv?.forEach(a => { csv += `"${a.proveedores?.nombre}","${a.monto}","${a.tipo}","${a.forma_pago}","${new Date(a.creado_en).toLocaleDateString('es-MX')}"\n` })
      csv += '\n=== CATÁLOGO DE PRODUCTOS ===\nNombre,Precio,Unidad\n'
      productos?.forEach(p => { csv += `"${p.nombre}","${p.precio}","${p.unidad}"\n` })
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `CreditOS_${fechaStr}.csv`; a.click()
      URL.revokeObjectURL(url)
      setListo(true)
    } catch (err) { alert('Error: ' + err.message) }
    setExportando(false)
  }

  async function limpiarServidor() {
    if (!confirm('¿Eliminar TODOS los registros? No se puede deshacer.')) return
    setExportando(true)
    await supabase.from('abonos_clientes_detalle').delete().neq('id','00000000-0000-0000-0000-000000000000')
    await supabase.from('abonos_proveedores_detalle').delete().neq('id','00000000-0000-0000-0000-000000000000')
    await supabase.from('abonos_clientes').delete().neq('id','00000000-0000-0000-0000-000000000000')
    await supabase.from('abonos_proveedores').delete().neq('id','00000000-0000-0000-0000-000000000000')
    await supabase.from('ticket_items').delete().neq('id','00000000-0000-0000-0000-000000000000')
    await supabase.from('tickets').delete().neq('id','00000000-0000-0000-0000-000000000000')
    await supabase.from('compras_proveedores').delete().neq('id','00000000-0000-0000-0000-000000000000')
    setExportando(false); setListo(false); setConfirmarLimpiar(false)
    alert('Servidor limpio.')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="sec" style={{ margin: 0 }}>Exportar concentrado</div>
        <button className="btn btn-sm" onClick={() => setConfigOpen(v => !v)}>⚙ Configurar ticket</button>
      </div>

      {configOpen && (
        <div className="abono-form" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Configuración del ticket</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="inp-row"><label>Nombre del negocio</label><input value={config.nombre_negocio||''} onChange={e => setConfig(v=>({...v,nombre_negocio:e.target.value}))} placeholder="Mi Negocio" /></div>
              <div className="inp-row"><label>Slogan o subtítulo</label><input value={config.slogan||''} onChange={e => setConfig(v=>({...v,slogan:e.target.value}))} placeholder="Frase corta opcional" /></div>
              <div className="g2">
                <div className="inp-row"><label>Teléfono</label><input value={config.telefono||''} onChange={e => setConfig(v=>({...v,telefono:e.target.value}))} placeholder="444 123 4567" /></div>
                <div className="inp-row"><label>Pie de página</label><input value={config.pie||''} onChange={e => setConfig(v=>({...v,pie:e.target.value}))} placeholder="Gracias por su preferencia" /></div>
              </div>

              <div className="inp-row">
                <label>Ancho de impresora</label>
                <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
                    <input type="radio" name="ancho" value="58" checked={(config.ancho||'58')==='58'} onChange={e => setConfig(v=>({...v,ancho:e.target.value}))} style={{ width: 'auto' }} /> 58mm
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
                    <input type="radio" name="ancho" value="80" checked={config.ancho==='80'} onChange={e => setConfig(v=>({...v,ancho:e.target.value}))} style={{ width: 'auto' }} /> 80mm
                  </label>
                </div>
              </div>

              <div className="inp-row">
                <label>Mostrar unidad (caja/pieza) en el ticket</label>
                <select value={config.mostrar_unidad ? 'si' : 'no'} onChange={e => setConfig(v=>({...v,mostrar_unidad:e.target.value==='si'}))}>
                  <option value="no">No — solo cantidad y producto (mas limpio)</option>
                  <option value="si">Si — cantidad, unidad y producto</option>
                </select>
              </div>

              <div className="g2">
                <div className="inp-row"><label>Tamaño de fuente (6-16)</label><input type="number" value={config.font_size} onChange={e => setConfig(v=>({...v,font_size:e.target.value}))} min="6" max="16" step="0.5" /></div>
                <div className="inp-row"><label>Interlineado (0.30-0.60)</label><input type="number" value={config.interlineado} onChange={e => setConfig(v=>({...v,interlineado:e.target.value}))} min="0.3" max="0.6" step="0.05" /></div>
              </div>
              <div className="g2">
                <div className="inp-row"><label>Margen izquierdo (mm)</label><input type="number" value={config.margen_izq} onChange={e => setConfig(v=>({...v,margen_izq:e.target.value}))} min="0" max="10" step="0.5" /></div>
                <div className="inp-row"><label>Margen derecho (mm)</label><input type="number" value={config.margen_der} onChange={e => setConfig(v=>({...v,margen_der:e.target.value}))} min="0" max="10" step="0.5" /></div>
              </div>
              <div className="g2">
                <div className="inp-row"><label>Margen superior (mm)</label><input type="number" value={config.margen_sup} onChange={e => setConfig(v=>({...v,margen_sup:e.target.value}))} min="0" max="20" step="0.5" /></div>
                <div className="inp-row"><label>Alto máx. de página (mm)</label><input type="number" value={config.alto_max} onChange={e => setConfig(v=>({...v,alto_max:e.target.value}))} min="100" max="1000" step="10" /></div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -4, marginBottom: 8 }}>
                Si el ticket supera el alto máximo, se divide en páginas para que la impresora no lo recorte. Usa un valor menor al alto del papel en Windows (ej. 280 si tu papel es de 297).
              </div>

              <div className="inp-row">
                <label>Logo (imagen)</label>
                <label className={`foto-upload${logoPreview ? ' ok' : ''}`}>
                  {logoPreview ? 'Logo cargado — clic para cambiar' : '+ Subir logo (JPG o PNG)'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
                </label>
              </div>
              {logoPreview && (
                <>
                  <img src={logoPreview} alt="Logo" style={{ maxWidth: 140, maxHeight: 60, borderRadius: 6, marginBottom: 8, objectFit: 'contain', background: '#fff', padding: 4 }} />
                  <div className="g2">
                    <div className="inp-row"><label>Ancho del logo (mm)</label><input type="number" value={config.logo_ancho} onChange={e => setConfig(v=>({...v,logo_ancho:e.target.value}))} min="10" max="80" step="1" /></div>
                    <div className="inp-row"><label>Alto del logo (mm)</label><input type="number" value={config.logo_alto} onChange={e => setConfig(v=>({...v,logo_alto:e.target.value}))} min="5" max="60" step="1" /></div>
                  </div>
                  <div className="g2">
                    <div className="inp-row">
                      <label>Posición del logo</label>
                      <select value={config.logo_align||'centro'} onChange={e => setConfig(v=>({...v,logo_align:e.target.value}))}>
                        <option value="izquierda">Izquierda</option>
                        <option value="centro">Centro</option>
                        <option value="derecha">Derecha</option>
                      </select>
                    </div>
                    <div className="inp-row">
                      <label>Logo en la copia</label>
                      <select value={config.logo_en_copia ? 'si' : 'no'} onChange={e => setConfig(v=>({...v,logo_en_copia:e.target.value==='si'}))}>
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-sm" style={{ marginBottom: 8, color: 'var(--red)' }} onClick={() => { setLogoPreview(null); setConfig(v => ({ ...v, logo: null })) }}>Quitar logo</button>
                </>
              )}

              <div className="inp-row">
                <label>Modo de impresión</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                    <input type="radio" name="modoimp" value="rapido" checked={(config.modo_impresion||'rapido')==='rapido'} onChange={e => setConfig(v=>({...v,modo_impresion:e.target.value}))} style={{ width: 'auto' }} /> Rápido — abre la ventana de imprimir directo
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
                    <input type="radio" name="modoimp" value="descargar" checked={config.modo_impresion==='descargar'} onChange={e => setConfig(v=>({...v,modo_impresion:e.target.value}))} style={{ width: 'auto' }} /> Descargar PDF — abrir con Adobe (como antes)
                  </label>
                </div>
              </div>
            </div>

            <div style={{ width: config.ancho === '80' ? 330 : 260, minWidth: 240 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Vista previa</div>
              {previewUri
                ? <iframe title="Vista previa del ticket" src={previewUri} style={{ width: '100%', height: 480, border: '1px solid var(--border)', borderRadius: 8, background: '#525659' }} />
                : <div style={{ fontSize: 12, color: 'var(--text2)', padding: 20 }}>Generando vista previa...</div>}
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Se actualiza sola al cambiar cualquier medida. Es el PDF real con datos de muestra.</div>
            </div>

          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setConfigOpen(false)}>Cancelar</button>
            <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={guardarConfig}>Guardar configuración</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className={`btn${modo==='cliente'?' btn-p':''}`} style={{ flex: 1, fontSize: 13 }} onClick={() => { setModo('cliente'); setSeleccion('') }}>Por cliente</button>
          <button className={`btn${modo==='proveedor'?' btn-p':''}`} style={{ flex: 1, fontSize: 13 }} onClick={() => { setModo('proveedor'); setSeleccion('') }}>Por proveedor</button>
        </div>

        {modo === 'cliente' && (
          <>
            <div className="inp-row">
              <label>Selecciona el cliente</label>
              <select value={seleccion} onChange={e => setSeleccion(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }} onClick={() => setIncluirLiquidadas(v => !v)}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${incluirLiquidadas?'var(--blue)':'var(--text2)'}`, background: incluirLiquidadas?'var(--blue)':'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {incluirLiquidadas && <span style={{ color: '#111', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Incluir compras ya liquidadas</span>
            </div>
            <button className="btn btn-p btn-f" onClick={exportarCliente} disabled={exportando||!seleccion}>
              {exportando ? 'Generando PDF...' : 'Generar e imprimir ticket'}
            </button>
          </>
        )}

        {modo === 'proveedor' && (
          <>
            <div className="inp-row">
              <label>Selecciona el proveedor</label>
              <select value={seleccion} onChange={e => setSeleccion(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }} onClick={() => setIncluirLiquidadas(v => !v)}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${incluirLiquidadas?'var(--blue)':'var(--text2)'}`, background: incluirLiquidadas?'var(--blue)':'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {incluirLiquidadas && <span style={{ color: '#111', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Incluir compras ya liquidadas</span>
            </div>
            <button className="btn btn-p btn-f" onClick={exportarProveedor} disabled={exportando||!seleccion}>
              {exportando ? 'Generando PDF...' : 'Generar e imprimir ticket'}
            </button>
          </>
        )}
      </div>

      <div className="sec">Respaldo completo</div>
      <div className="exp-card">
        <div className="exp-row">
          <div className="exp-info"><h3>Exportar todo a CSV</h3><p>Todos los clientes, proveedores, movimientos y catálogo</p></div>
          <button className="btn btn-p btn-sm" onClick={exportarTodo} disabled={exportando}>{exportando?'Exportando...':'Exportar CSV'}</button>
        </div>
        {listo && <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--green-bg)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Archivo descargado. Guárdalo en lugar seguro.</div>}
      </div>

      <div className="exp-card">
        <div className="exp-row">
          <div className="exp-info"><h3>Limpiar servidor</h3><p>{listo?'Disponible — respaldo confirmado':'Primero exporta el CSV completo'}</p></div>
          <button className={`btn btn-sm${listo?' btn-d':''}`} style={{ opacity: listo?1:0.4, cursor: listo?'pointer':'not-allowed' }} onClick={() => listo && setConfirmarLimpiar(true)}>Limpiar</button>
        </div>
        {confirmarLimpiar && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--red-bg)', borderRadius: 'var(--radius)', fontSize: 12 }}>
            <div style={{ color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>Esta acción eliminará todos los movimientos. No se puede deshacer.</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setConfirmarLimpiar(false)}>Cancelar</button>
              <button className="btn btn-d btn-sm" onClick={limpiarServidor}>Confirmar limpieza</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
