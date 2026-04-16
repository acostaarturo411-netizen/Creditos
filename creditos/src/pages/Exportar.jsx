import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Exportar() {
  const [exportando, setExportando] = useState(false)
  const [progreso, setProgreso] = useState('')
  const [listo, setListo] = useState(false)
  const [confirmarLimpiar, setConfirmarLimpiar] = useState(false)

  async function exportarTodo() {
    setExportando(true)
    setListo(false)
    try {
      setProgreso('Obteniendo clientes...')
      const { data: clientes } = await supabase.from('clientes').select('*')
      const { data: proveedores } = await supabase.from('proveedores').select('*')
      const { data: tickets } = await supabase.from('tickets').select('*, ticket_items(*), clientes(nombre)')
      const { data: abonosClientes } = await supabase.from('abonos_clientes').select('*, clientes(nombre)')
      const { data: comprasProv } = await supabase.from('compras_proveedores').select('*, proveedores(nombre)')
      const { data: abonosProv } = await supabase.from('abonos_proveedores').select('*, proveedores(nombre)')
      const { data: productos } = await supabase.from('productos').select('*')

      setProgreso('Generando archivos...')

      const now = new Date()
      const fechaStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

      let csv = 'CREDITÓS — EXPORTACIÓN COMPLETA\n'
      csv += `Fecha: ${now.toLocaleDateString('es-MX')} ${now.toLocaleTimeString('es-MX')}\n\n`

      csv += '=== CLIENTES ===\n'
      csv += 'Nombre,Teléfono,Registrado\n'
      clientes?.forEach(c => { csv += `"${c.nombre}","${c.telefono||''}","${new Date(c.creado_en).toLocaleDateString('es-MX')}"\n` })

      csv += '\n=== TICKETS DE VENTA ===\n'
      csv += 'Ticket#,Cliente,Total,Fecha,Productos\n'
      tickets?.forEach(t => {
        const prods = t.ticket_items?.map(i => `${i.descripcion}(${i.cantidad}${i.unidad})`).join(' | ')
        csv += `"${t.numero}","${t.clientes?.nombre}","${t.total}","${new Date(t.creado_en).toLocaleDateString('es-MX')}","${prods}"\n`
      })

      csv += '\n=== ABONOS DE CLIENTES ===\n'
      csv += 'Cliente,Monto,Tipo,Forma de pago,Fecha,Foto\n'
      abonosClientes?.forEach(a => {
        csv += `"${a.clientes?.nombre}","${a.monto}","${a.tipo}","${a.forma_pago}","${new Date(a.creado_en).toLocaleDateString('es-MX')}","${a.foto_url||'Sin foto'}"\n`
      })

      csv += '\n=== PROVEEDORES ===\n'
      csv += 'Nombre,Teléfono,Registrado\n'
      proveedores?.forEach(p => { csv += `"${p.nombre}","${p.telefono||''}","${new Date(p.creado_en).toLocaleDateString('es-MX')}"\n` })

      csv += '\n=== COMPRAS A PROVEEDORES ===\n'
      csv += 'Proveedor,Descripción,Total,Fecha\n'
      comprasProv?.forEach(c => {
        csv += `"${c.proveedores?.nombre}","${c.descripcion||''}","${c.total}","${new Date(c.creado_en).toLocaleDateString('es-MX')}"\n`
      })

      csv += '\n=== ABONOS A PROVEEDORES ===\n'
      csv += 'Proveedor,Monto,Tipo,Forma de pago,Fecha,Foto\n'
      abonosProv?.forEach(a => {
        csv += `"${a.proveedores?.nombre}","${a.monto}","${a.tipo}","${a.forma_pago}","${new Date(a.creado_en).toLocaleDateString('es-MX')}","${a.foto_url||'Sin foto'}"\n`
      })

      csv += '\n=== CATÁLOGO DE PRODUCTOS ===\n'
      csv += 'Nombre,Precio,Unidad\n'
      productos?.forEach(p => { csv += `"${p.nombre}","${p.precio}","${p.unidad}"\n` })

      setProgreso('Descargando...')

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CreditOS_${fechaStr}.csv`
      a.click()
      URL.revokeObjectURL(url)

      setListo(true)
      setProgreso('')
    } catch (err) {
      alert('Error al exportar: ' + err.message)
      setProgreso('')
    }
    setExportando(false)
  }

  async function limpiarServidor() {
    if (!listo) return alert('Primero confirma que descargaste el archivo correctamente')
    if (!confirm('¿Estás seguro? Se eliminarán TODOS los registros del servidor. Esta acción no se puede deshacer.')) return
    setExportando(true)
    setProgreso('Limpiando servidor...')
    await supabase.from('abonos_clientes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('abonos_proveedores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('ticket_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('compras_proveedores').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setProgreso('')
    setListo(false)
    setExportando(false)
    setConfirmarLimpiar(false)
    alert('Servidor limpio. Clientes, proveedores y productos se conservaron.')
  }

  return (
    <div>
      <div className="sec">Exportar y respaldar</div>

      <div className="exp-card">
        <div className="exp-row">
          <div className="exp-info">
            <h3>Exportar todo a CSV</h3>
            <p>Clientes, tickets, abonos, proveedores, compras y catálogo</p>
          </div>
          <button className="btn btn-p btn-sm" onClick={exportarTodo} disabled={exportando}>
            {exportando ? progreso || 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
        {listo && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--green-bg)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--green)' }}>
            Archivo descargado correctamente. Guárdalo en un lugar seguro antes de limpiar.
          </div>
        )}
      </div>

      <div className="exp-card">
        <div className="exp-row">
          <div className="exp-info">
            <h3>Limpiar servidor</h3>
            <p>{listo ? 'Disponible — descarga confirmada' : 'Primero exporta y confirma la descarga'}</p>
          </div>
          <button
            className={`btn btn-sm${listo ? ' btn-d' : ''}`}
            style={{ opacity: listo ? 1 : 0.4, cursor: listo ? 'pointer' : 'not-allowed' }}
            onClick={() => listo && setConfirmarLimpiar(true)}
          >
            Limpiar
          </button>
        </div>
        {confirmarLimpiar && (
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--red-bg)', borderRadius: 'var(--radius)', fontSize: 12 }}>
            <div style={{ color: 'var(--red)', fontWeight: 500, marginBottom: 8 }}>Esta acción eliminará todos los registros de movimientos del servidor. No se puede deshacer.</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setConfirmarLimpiar(false)}>Cancelar</button>
              <button className="btn btn-d btn-sm" onClick={limpiarServidor}>Confirmar limpieza</button>
            </div>
          </div>
        )}
      </div>

      <div className="exp-card">
        <div className="exp-row">
          <div className="exp-info">
            <h3>¿Qué se exporta?</h3>
            <p>Un archivo CSV con todos tus datos, abierto en Excel con un clic</p>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
          El archivo incluye: clientes y sus saldos · tickets de venta detallados · abonos recibidos con tipo y forma de pago · proveedores y compras · tus abonos a proveedores · catálogo de productos.<br /><br />
          Las fotos de evidencia quedan referenciadas por nombre en el CSV. Para descargarlas, entra a tu proyecto en Supabase → Storage → evidencias.
        </div>
      </div>
    </div>
  )
}
