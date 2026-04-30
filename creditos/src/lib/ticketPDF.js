const ANCHO = 32
function linea(c = '-') { return c.repeat(ANCHO) }
function dosCol(iz, de, ancho = ANCHO) { return iz + ' '.repeat(Math.max(1, ancho - iz.length - de.length)) + de }
function truncar(t, max) { return t && t.length > max ? t.slice(0, max - 1) + '.' : (t || '') }

export async function imprimirTicketVenta({ numero, cliente, fecha, items, total, config = {} }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: [58, 297], orientation: 'portrait' })
  const margen = 2
  const ancho = 54
  let y = 6
  const fs = parseFloat(config.font_size) || 7
  const lh = fs * 0.65

  doc.setFont('courier', 'normal')

  // Logo
  if (config.logo) {
    try {
      const img = new Image()
      img.src = config.logo
      doc.addImage(config.logo, 'JPEG', margen + 4, y, 46, 16)
      y += 19
    } catch(e) { console.error('Logo error:', e) }
  }

  // Encabezado
  doc.setFontSize(fs + 3); doc.setFont('courier', 'bold')
  doc.text(config.nombre_negocio || 'CREDITOS', ancho / 2 + margen, y, { align: 'center' }); y += lh + 2

  if (config.slogan) {
    doc.setFontSize(fs); doc.setFont('courier', 'normal')
    doc.text(config.slogan, ancho / 2 + margen, y, { align: 'center' }); y += lh + 1
  }

  if (config.telefono) {
    doc.setFontSize(fs); doc.setFont('courier', 'normal')
    doc.text(config.telefono, ancho / 2 + margen, y, { align: 'center' }); y += lh + 1
  }

  doc.setFontSize(fs); doc.setFont('courier', 'normal')
  doc.text(linea('='), margen, y); y += lh
  doc.text(`Cliente: ${truncar(cliente, 26)}`, margen, y); y += lh
  doc.text(`Ticket #${numero}  ${new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}`, margen, y); y += lh
  doc.text(linea('-'), margen, y); y += lh

  // Productos con desglose
  items.forEach(item => {
    const cant = `${item.cantidad} ${item.unidad}`
    const desc = truncar(item.descripcion, 22)
    const precioU = `$${parseFloat(item.precio_unitario).toLocaleString('es-MX')}`
    const subtotal = `$${parseFloat(item.subtotal || item.cantidad * item.precio_unitario).toLocaleString('es-MX')}`

    doc.setFont('courier', 'normal')
    doc.text(`${cant} ${desc}`, margen, y); y += lh
    doc.text(dosCol(`  ${precioU} c/u`, subtotal, ANCHO), margen, y); y += lh
  })

  doc.text(linea('-'), margen, y); y += lh
  doc.setFontSize(fs + 1); doc.setFont('courier', 'bold')
  doc.text(dosCol('TOTAL:', `$${parseFloat(total).toLocaleString('es-MX')}`), margen, y); y += lh + 2

  doc.setFontSize(fs); doc.setFont('courier', 'normal')
  doc.text(linea('='), margen, y); y += lh

  if (config.pie) {
    doc.text(config.pie, ancho / 2 + margen, y, { align: 'center' }); y += lh
  } else {
    doc.text('Gracias por su compra', ancho / 2 + margen, y, { align: 'center' }); y += lh
  }
  doc.text(linea('='), margen, y)

  doc.save(`Ticket_${numero}_${cliente.replace(/\s/g,'_')}.pdf`)
}
