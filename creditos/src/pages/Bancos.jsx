import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function generarTicketBanco(config, proveedor, tipoCuenta) {
  const { jsPDF } = window.jspdf || {}
  // Se usa el mismo generador de PDF que Exportar
  return { proveedor, tipoCuenta, config }
}

export default function Bancos() {
  const [proveedores, setProveedores] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState(null)
  const [provId, setProvId] = useState('')
  const [banco, setBanco] = useState('')
  const [beneficiario, setBeneficiario] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [clabe, setClabe] = useState('')
  const [imprimiendo, setImprimiendo] = useState(null)
  const [monto, setMonto] = useState('')
  const [tipoCuenta, setTipoCuenta] = useState('clabe')

  useEffect(() => { loadDatos() }, [])

  async function loadDatos() {
    setLoading(true)
    const { data: provs } = await supabase.from('proveedores').select('id,nombre').order('nombre')
    const { data: ctas } = await supabase.from('cuentas_bancarias').select('*, proveedores(nombre)').order('creado_en', { ascending: false })
    setProveedores(provs || [])
    setCuentas(ctas || [])
    setLoading(false)
  }

  function limpiarForm() {
    setProvId(''); setBanco(''); setBeneficiario(''); setCuenta(''); setClabe(''); setMonto(''); setTipoCuenta('clabe')
    setEditando(null); setFormOpen(false)
  }

  async function guardar() {
    if (!provId || !banco || !beneficiario) return alert('Proveedor, banco y beneficiario son obligatorios')
    if (!cuenta && !clabe) return alert('Ingresa número de cuenta o CLABE')
    if (editando) {
      await supabase.from('cuentas_bancarias').update({ proveedor_id: provId, banco, beneficiario, cuenta, clabe }).eq('id', editando.id)
    } else {
      await supabase.from('cuentas_bancarias').insert({ proveedor_id: provId, banco, beneficiario, cuenta, clabe })
    }
    limpiarForm()
    loadDatos()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta cuenta bancaria?')) return
    await supabase.from('cuentas_bancarias').delete().eq('id', id)
    loadDatos()
  }

  function iniciarEdicion(c) {
    setEditando(c)
    setProvId(c.proveedor_id)
    setBanco(c.banco)
    setBeneficiario(c.beneficiario)
    setCuenta(c.cuenta || '')
    setClabe(c.clabe || '')
    setFormOpen(true)
  }

  async function imprimirTicket(c) {
    setImprimiendo(c.id)
    const montoNum = parseFloat(monto.replace(/[^0-9.]/g, '')) || 0
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: [58, 200], orientation: 'portrait' })
      const ancho = 54
      const margen = 2
      let y = 6

      doc.setFont('courier', 'bold')
      doc.setFontSize(11)
      doc.text('CREDITOS', ancho / 2 + margen, y, { align: 'center' })
      y += 5

      doc.setFontSize(7)
      doc.setFont('courier', 'normal')
      doc.text('================================', margen, y); y += 4
      doc.setFont('courier', 'bold')
      doc.text('DEPOSITO A PROVEEDOR', margen, y); y += 4
      doc.setFont('courier', 'normal')
      doc.text('--------------------------------', margen, y); y += 4
      doc.text(`Beneficiario:`, margen, y); y += 3.5
      doc.setFont('courier', 'bold')
      doc.text(`${c.beneficiario}`, margen, y); y += 4
      doc.setFont('courier', 'normal')
      doc.text(`Banco: ${c.banco}`, margen, y); y += 4

      if (tipoCuenta === 'clabe' && c.clabe) {
        doc.text('CLABE:', margen, y); y += 3.5
        doc.setFont('courier', 'bold')
        doc.text(`${c.clabe}`, margen, y); y += 4
        doc.setFont('courier', 'normal')
      } else if (tipoCuenta === 'cuenta' && c.cuenta) {
        doc.text('No. Cuenta:', margen, y); y += 3.5
        doc.setFont('courier', 'bold')
        doc.text(`${c.cuenta}`, margen, y); y += 4
        doc.setFont('courier', 'normal')
      } else {
        if (c.clabe) { doc.text(`CLABE: ${c.clabe}`, margen, y); y += 4 }
        if (c.cuenta) { doc.text(`Cuenta: ${c.cuenta}`, margen, y); y += 4 }
      }

      doc.text('--------------------------------', margen, y); y += 4
      if (montoNum > 0) {
        doc.setFont('courier', 'bold')
        doc.setFontSize(8)
        const montoStr = `$${montoNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        const label = 'Cantidad:'
        const espacio = Math.max(1, 32 - label.length - montoStr.length)
        doc.text(label + ' '.repeat(espacio) + montoStr, margen, y); y += 5
        doc.setFont('courier', 'normal')
        doc.setFontSize(7)
      }
      doc.text('================================', margen, y); y += 4
      doc.text('\n\n', margen, y)

      doc.save(`Deposito_${c.beneficiario.replace(/\s/g,'_')}.pdf`)
    } catch (err) {
      alert('Error al generar PDF: ' + err.message)
    }
    setImprimiendo(null)
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text2)', fontSize: 13 }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="sec" style={{ margin: 0 }}>Datos bancarios de proveedores</div>
        <button className="btn btn-p btn-sm" onClick={() => { limpiarForm(); setFormOpen(true) }}>+ Agregar cuenta</button>
      </div>

      {formOpen && (
        <div className="abono-form" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{editando ? 'Editar cuenta' : 'Nueva cuenta bancaria'}</div>
          <div className="inp-row">
            <label>Proveedor</label>
            <select value={provId} onChange={e => setProvId(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="g2">
            <div className="inp-row"><label>Banco</label><input value={banco} onChange={e => setBanco(e.target.value)} placeholder="BBVA, Banamex..." /></div>
            <div className="inp-row"><label>Beneficiario</label><input value={beneficiario} onChange={e => setBeneficiario(e.target.value)} placeholder="Nombre completo" /></div>
          </div>
          <div className="g2">
            <div className="inp-row"><label>Número de cuenta</label><input value={cuenta} onChange={e => setCuenta(e.target.value)} placeholder="Opcional" /></div>
            <div className="inp-row"><label>CLABE interbancaria</label><input value={clabe} onChange={e => setClabe(e.target.value)} placeholder="18 dígitos" /></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={limpiarForm}>Cancelar</button>
            <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={guardar}>Guardar</button>
          </div>
        </div>
      )}

      {cuentas.length === 0 && !formOpen && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', padding: '20px 0' }}>Sin cuentas bancarias. Agrega la primera.</div>
        </div>
      )}

      {cuentas.map(c => (
        <div key={c.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{c.beneficiario}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{c.proveedores?.nombre} · {c.banco}</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--blue)' }} onClick={() => iniciarEdicion(c)}>Editar</button>
                <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => eliminar(c.id)}>Eliminar</button>
              </div>
            </div>
            {c.clabe && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>CLABE: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{c.clabe}</span></div>}
            {c.cuenta && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Cuenta: <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{c.cuenta}</span></div>}
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Cantidad a depositar (opcional)"
              value={imprimiendo === c.id ? monto : ''}
              onChange={e => setMonto(e.target.value)}
              onFocus={() => setImprimiendo(c.id)}
              style={{ flex: 1, minWidth: 160, fontSize: 13 }}
            />
            <select value={tipoCuenta} onChange={e => setTipoCuenta(e.target.value)} style={{ width: 110, fontSize: 12 }}>
              {c.clabe && <option value="clabe">Con CLABE</option>}
              {c.cuenta && <option value="cuenta">Con cuenta</option>}
              {c.clabe && c.cuenta && <option value="ambas">Ambas</option>}
            </select>
            <button className="btn btn-p btn-sm" onClick={() => imprimirTicket(c)}>Imprimir ticket</button>
          </div>
        </div>
      ))}
    </div>
  )
}
