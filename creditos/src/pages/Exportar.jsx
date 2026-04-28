import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function generarTicketPDF(titulo, subtitulo, compras, abonos, totalComprado, totalAbonado, saldo) {
  const lineas = []
  const fecha = new Date().toLocaleDateString('es-MX')

  lineas.push({ t: 'titulo', v: 'CREDITOS' })
  lineas.push({ t: 'sep' })
  lineas.push({ t: 'bold', v: subtitulo })
  lineas.push({ t: 'small', v: `${titulo}` })
  lineas.push({ t: 'small', v: `Emitido: ${fecha}` })
  lineas.push({ t: 'sep' })
  lineas.push({ t: 'bold', v: 'COMPRAS:' })

  compras.forEach(c => {
    const fecha = new Date(c.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
    const desc = (c.descripcion || c.productos || 'Compra').slice(0, 18)
    const monto = `$${parseFloat(c.total).toLocaleString('es-MX')}`
    lineas.push({ t: 'fila', iz: `${fecha} ${desc}`, de: monto })
  })

  lineas.push({ t: 'sep' })
  lineas.push({ t: 'fila', iz: 'TOTAL COMPRADO:', de: `$${totalComprado.toLocaleString('es-MX')}`, bold: true })
  lineas.push({ t: 'sep' })
  lineas.push({ t: 'bold', v: 'ABONOS:' })

  abonos.forEach(a => {
    const fecha = new Date(a.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
    const tipo = a.forma_pago === 'transferencia' ? 'Transfer.' : a.forma_pago === 'efectivo' ? 'Efectivo' : 'Deposito'
    const monto = `$${parseFloat(a.monto).toLocaleString('es-MX')}`
    lineas.push({ t: 'fila', iz: `${fecha} ${tipo}`, de: monto })
  })

  lineas.push({ t: 'sep' })
  lineas.push({ t: 'fila', iz: 'TOTAL ABONADO:', de: `$${totalAbonado.toLocaleString('es-MX')}`, bold: true })
  lineas.push({ t: 'sep2' })
  lineas.push({ t: 'fila', iz: 'SALDO PENDIENTE:', de: `$${saldo.toLocaleString('es-MX')}`, bold: true, grande: true })
  lineas.push({ t: 'sep2' })

  return lineas
}

async function imprimirTicket(lineas, nombreArchivo) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: [58, 297], orientation: 'portrait' })

  const ancho = 54
  const margen = 2
  let y = 6
  const lh = 4.5

  doc.setFont('courier', 'normal')

  for (const l of lineas) {
    if (l.t === 'titulo') {
      doc.setFontSize(11)
      doc.setFont('courier', 'bold')
      doc.text(l.v, ancho / 2 + margen, y, { align: 'center' })
      y += lh + 1
      doc.setFont('courier', 'normal')
      doc.setFontSize(7)
    } else if (l.t === 'sep') {
      doc.setFontSize(7)
      doc.text('--------------------------------', margen, y)
      y += lh
    } else if (l.t === 'sep2') {
      doc.setFontSize(7)
      doc.text('================================', margen, y)
      y += lh
    } else if (l.t === 'bold') {
      doc.setFontSize(7.5)
      doc.setFont('courier', 'bold')
      doc.text(l.v, margen, y)
      y += lh
      doc.setFont('courier', 'normal')
      doc.setFontSize(7)
    } else if (l.t === 'small') {
      doc.setFontSize(6.5)
      doc.setFont('courier', 'normal')
      doc.text(l.v, margen, y)
      y += lh - 0.5
    } else if (l.t === 'fila') {
      const fs = l.grande ? 8 : 7
      doc.setFontSize(fs)
      if (l.bold) doc.setFont('courier', 'bold')
      else doc.setFont('courier', 'normal')
      doc.text(l.iz, margen, y)
      doc.text(l.de, ancho + margen, y, { align: 'right' })
      y += lh
    }
    if (y > doc.internal.pageSize.getHeight() - 10) {
      doc.addPage([58, 297])
      y = 6
    }
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

  useEffect(() => {
    supabase.from('clientes').select('id,nombre').order('nombre').then(({ data }) => setClientes(data || []))
    supabase.from('proveedores').select('id,nombre').order('nombre').then(({ data }) => { setProveedores(data || []); setCargando(false) })
  }, [])

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
    }).map(t => ({
      ...t,
      descripcion: t.ticket_items?.map(i => i.descripcion).join(', '),
      total: t.total
    }))

    const totalComprado = comprasFiltradas.reduce((s, t) => s + t.total, 0)
    const totalAbonado = (abonosData || []).reduce((s, a) => s + a.monto, 0)
    const saldo = Math.max(0, totalComprado - totalAbonado)

    const lineas = generarTicketPDF('CLIENTE', cliente.nombre, comprasFiltradas, abonosData || [], totalComprado, totalAbonado, saldo)
    await imprimirTicket(lineas, `CreditOS_Cliente_${cliente.nombre.replace(/\s/g,'_')}`)
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

    const lineas = generarTicketPDF('PROVEEDOR', proveedor.nombre, comprasFiltradas, abonosData || [], totalComprado, totalAbonado, saldo)
    await imprimirTicket(lineas, `CreditOS_Proveedor_${proveedor.nombre.replace(/\s/g,'_')}`)
    setExportando(false)
  }

  async function exportarTodo() {
    setExportando(true)
    setListo(false)
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
      tickets?.forEach(t => {
        const prods = t.ticket_items?.map(i => `${i.descripcion}`).join(' | ')
        csv += `"${t.numero}","${t.clientes?.nombre}","${t.total}","${new Date(t.creado_en).toLocaleDateString('es-MX')}","${prods}"\n`
      })
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
      const a = document.createElement('a')
      a.href = url; a.download = `CreditOS_${fechaStr}.csv`; a.click()
      URL.revokeObjectURL(url)
      setListo(true)
    } catch (err) {
      alert('Error al exportar: ' + err.message)
    }
    setExportando(false)
  }

  async function limpiarServidor() {
    if (!confirm('¿Estás seguro? Se eliminarán TODOS los registros. No se puede deshacer.')) return
    setExportando(true)
    await supabase.from('abonos_clientes_detalle').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('abonos_proveedores_detalle').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('abonos_clientes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('abonos_proveedores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('ticket_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('compras_proveedores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setExportando(false)
    setConfirmarLimpiar(false)
    setListo(false)
    alert('Servidor limpio. Clientes, proveedores y productos se conservaron.')
  }

  return (
    <div>
      <div className="sec">Exportar concentrado</div>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className={`btn${modo === 'cliente' ? ' btn-p' : ''}`} style={{ flex: 1, fontSize: 13 }} onClick={() => { setModo('cliente'); setSeleccion('') }}>Por cliente</button>
          <button className={`btn${modo === 'proveedor' ? ' btn-p' : ''}`} style={{ flex: 1, fontSize: 13 }} onClick={() => { setModo('proveedor'); setSeleccion('') }}>Por proveedor</button>
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
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${incluirLiquidadas ? 'var(--blue)' : 'var(--text2)'}`, background: incluirLiquidadas ? 'var(--blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {incluirLiquidadas && <span style={{ color: '#111', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Incluir compras ya liquidadas</span>
            </div>
            <button className="btn btn-p btn-f" onClick={exportarCliente} disabled={exportando || !seleccion}>
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
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${incluirLiquidadas ? 'var(--blue)' : 'var(--text2)'}`, background: incluirLiquidadas ? 'var(--blue)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {incluirLiquidadas && <span style={{ color: '#111', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>Incluir compras ya liquidadas</span>
            </div>
            <button className="btn btn-p btn-f" onClick={exportarProveedor} disabled={exportando || !seleccion}>
              {exportando ? 'Generando PDF...' : 'Generar e imprimir ticket'}
            </button>
          </>
        )}
      </div>

      <div className="sec">Respaldo completo</div>
      <div className="exp-card">
        <div className="exp-row">
          <div className="exp-info">
            <h3>Exportar todo a CSV</h3>
            <p>Todos los clientes, proveedores, movimientos y catálogo</p>
          </div>
          <button className="btn btn-p btn-sm" onClick={exportarTodo} disabled={exportando}>
            {exportando ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
        {listo && <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--green-bg)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>Archivo descargado. Guárdalo en lugar seguro.</div>}
      </div>

      <div className="exp-card">
        <div className="exp-row">
          <div className="exp-info">
            <h3>Limpiar servidor</h3>
            <p>{listo ? 'Disponible — respaldo confirmado' : 'Primero exporta el CSV completo'}</p>
          </div>
          <button className={`btn btn-sm${listo ? ' btn-d' : ''}`} style={{ opacity: listo ? 1 : 0.4, cursor: listo ? 'pointer' : 'not-allowed' }} onClick={() => listo && setConfirmarLimpiar(true)}>Limpiar</button>
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
