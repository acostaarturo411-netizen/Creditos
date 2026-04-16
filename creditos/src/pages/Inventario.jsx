import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const UNIDADES = ['pieza', 'caja', 'media caja', 'kilo', 'metro', 'litro', 'paquete']

export default function Inventario() {
  const [productos, setProductos] = useState([])
  const [editando, setEditando] = useState(null)
  const [nuevoForm, setNuevoForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [unidad, setUnidad] = useState('pieza')
  const [busq, setBusq] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProductos() }, [])

  async function loadProductos() {
    setLoading(true)
    const { data } = await supabase.from('productos').select('*').eq('activo', true).order('nombre')
    if (data) setProductos(data)
    setLoading(false)
  }

  async function guardarNuevo() {
    if (!nombre || !precio) return
    await supabase.from('productos').insert({
      nombre: nombre.trim(),
      precio: parseFloat(precio),
      unidad
    })
    setNombre(''); setPrecio(''); setUnidad('pieza')
    setNuevoForm(false)
    loadProductos()
  }

  async function guardarEdicion() {
    if (!editando) return
    await supabase.from('productos').update({
      nombre: editando.nombre,
      precio: parseFloat(editando.precio),
      unidad: editando.unidad
    }).eq('id', editando.id)
    setEditando(null)
    loadProductos()
  }

  async function eliminarProducto(id) {
    if (!confirm('¿Eliminar este producto del catálogo?')) return
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    loadProductos()
  }

  const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(busq.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="sec" style={{ margin: 0 }}>Catálogo de productos</div>
        <button className="btn btn-p btn-sm" onClick={() => setNuevoForm(v => !v)}>+ Agregar producto</button>
      </div>

      {nuevoForm && (
        <div className="abono-form" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Nuevo producto</div>
          <div className="inp-row"><label>Nombre</label><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Tela lino beige" autoFocus /></div>
          <div className="g2">
            <div className="inp-row">
              <label>Precio</label>
              <input value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01" />
            </div>
            <div className="inp-row">
              <label>Unidad de venta</label>
              <select value={unidad} onChange={e => setUnidad(e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setNuevoForm(false)}>Cancelar</button>
            <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={guardarNuevo}>Guardar producto</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <input value={busq} onChange={e => setBusq(e.target.value)} placeholder="Buscar en el catálogo..." />
      </div>

      {loading ? (
        <div style={{ padding: 20, color: 'var(--text2)', fontSize: 13 }}>Cargando...</div>
      ) : (
        <div className="card">
          <div className="inv-row header">
            <div className="inv-name" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Producto</div>
            <div className="inv-unit" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Unidad</div>
            <div className="inv-price" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Precio</div>
            <div style={{ width: 60 }}></div>
          </div>
          {filtrados.length === 0 && (
            <div style={{ padding: '14px', fontSize: 13, color: 'var(--text2)' }}>
              {busq ? 'Sin resultados para esa búsqueda' : 'Sin productos. Agrega el primero.'}
            </div>
          )}
          {filtrados.map(p => (
            editando?.id === p.id ? (
              <div key={p.id} className="inv-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <input value={editando.nombre} onChange={e => setEditando(v => ({ ...v, nombre: e.target.value }))} style={{ flex: 1, minWidth: 120 }} />
                <select value={editando.unidad} onChange={e => setEditando(v => ({ ...v, unidad: e.target.value }))} style={{ width: 100 }}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input type="number" value={editando.precio} onChange={e => setEditando(v => ({ ...v, precio: e.target.value }))} style={{ width: 80 }} min="0" step="0.01" />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                  <button className="btn btn-p btn-sm" onClick={guardarEdicion}>Guardar</button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="inv-row">
                <div className="inv-name">{p.nombre}</div>
                <div className="inv-unit">{p.unidad.charAt(0).toUpperCase() + p.unidad.slice(1)}</div>
                <div className="inv-price">${parseFloat(p.precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className="inv-edit" onClick={() => setEditando({ ...p })}>Editar</span>
                  <span className="inv-edit" style={{ color: 'var(--red)' }} onClick={() => eliminarProducto(p.id)}>×</span>
                </div>
              </div>
            )
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
        {filtrados.length} productos · Los precios se sincronizan automáticamente con el buscador de venta
      </div>
    </div>
  )
}
