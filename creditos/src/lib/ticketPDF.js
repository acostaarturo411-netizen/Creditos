const ANCHO = 32
function linea(c = '-') { return c.repeat(ANCHO) }
function dosCol(iz, de) { return iz + ' '.repeat(Math.max(1, ANCHO - iz.length - de.length)) + de }
function truncar(t, max) { return t && t.length > max ? t.slice(0, max - 1) + '.' : (t || '') }

export async function imprimirTicketVenta({ numero, cliente, fecha, items, total, config = {} }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: [58, 297], orientation: 'portrait' })
  const margen = 2
  const ancho = 54
  let y = 6
  const lh = 4.5

  doc.setFont('courier', 'normal')

  if (config.logo) {
    try { doc.addImage(config.logo, 'JPEG', margen + 8, y, 38, 15); y += 18 } catch(e) {}
  }

  doc.setFontSize(11); doc.setFont('courier', 'bold')
  doc.text(config.nombre_negocio || 'CREDITOS', ancho / 2 + margen, y, { align: 'center' }); y += lh + 1
  if (config.slogan) {
    doc.setFontSize(7); doc.setFont('courier', 'normal')
    doc.text(config.slogan, ancho / 2 + margen, y, { align: 'center' }); y += lh
  }
  doc.setFontSize(7); doc.setFont('courier', 'normal')
  doc.text(linea('='), margen, y); y += lh
  doc.text(`Cliente: ${truncar(cliente, 24)}`, margen, y); y += lh
  doc.text(`Ticket #${numero}  ${new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}`, margen, y); y += lh
  doc.text(linea('-'), margen, y); y += lh

  items.forEach(item => {
    const cant = `${item.cantidad} ${item.unidad}`
    const precio = `$${parseFloat(item.precio_unitario).toLocaleString('es-MX')}`
    const desc = truncar(item.descripcion, ANCHO - precio.length - 1)
    doc.text(`${cant} ${desc}`, margen, y); y += lh
    doc.text(dosCol('', precio), margen, y); y += lh
  })

  doc.text(linea('-'), margen, y); y += lh
  doc.setFontSize(8); doc.setFont('courier', 'bold')
  doc.text(dosCol('TOTAL:', `$${parseFloat(total).toLocaleString('es-MX')}`), margen, y); y += lh + 1
  doc.setFontSize(7); doc.setFont('courier', 'normal')
  doc.text(linea('='), margen, y); y += lh
  if (config.pie) {
    doc.text(config.pie, ancho / 2 + margen, y, { align: 'center' }); y += lh
  } else {
    doc.text('Gracias por su compra', ancho / 2 + margen, y, { align: 'center' }); y += lh
  }
  doc.text(linea('='), margen, y)

  doc.save(`Ticket_${numero}_${cliente.replace(/\s/g,'_')}.pdf`)
}
