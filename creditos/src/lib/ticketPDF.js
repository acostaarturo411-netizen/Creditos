// Usa milímetros reales para posicionar texto en lugar de caracteres
function getMM(config) { return config.ancho === '80' ? 80 : 58 }
function truncarMM(doc, texto, maxMM) {
  // Trunca texto si excede el ancho máximo en mm
  let t = texto || ''
  while (t.length > 1 && doc.getTextWidth(t) > maxMM) { t = t.slice(0, -1) }
  return t
}

function numALetras(num) {
  const partes = num.toFixed(2).split('.')
  const entero = parseInt(partes[0])
  const centavos = partes[1]
  const unidades = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE','VEINTIUN','VEINTIDOS','VEINTITRES','VEINTICUATRO','VEINTICINCO','VEINTISEIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE']
  const decenas = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const centenas = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  function convertir(n) {
    if (n === 0) return ''
    if (n === 100) return 'CIEN'
    if (n < 30) return unidades[n]
    if (n < 100) { const d = Math.floor(n/10); const u = n%10; return u===0 ? decenas[d] : decenas[d]+' Y '+unidades[u] }
    const c = Math.floor(n/100); const resto = n%100
    return centenas[c]+(resto>0?' '+convertir(resto):'')
  }
  let resultado = ''
  if (entero >= 1000000) {
    const millones = Math.floor(entero/1000000); const restoM = entero%1000000
    resultado = (millones===1?'UN MILLON':convertir(millones)+' MILLONES')+(restoM>0?' '+convertir(Math.floor(restoM/1000))+(restoM%1000>0?' '+convertir(restoM%1000):''):'')
  } else if (entero >= 1000) {
    const miles = Math.floor(entero/1000); const resto = entero%1000
    resultado = (miles===1?'MIL':convertir(miles)+' MIL')+(resto>0?' '+convertir(resto):'')
  } else { resultado = convertir(entero) }
  return resultado+' '+centavos+'/100 M.N.'
}

function dibujarBloque(doc, config, numero, cliente, fecha, items, total, mm, margen, fs, lh, esCopia, yInicio) {
  let y = yInicio
  const anchoUtil = mm - (margen * 2) // ancho útil en mm
  const xDer = mm - margen // margen derecho

  doc.setFontSize(fs); doc.setFont('courier', 'normal')

  // ENCABEZADO COPIA
  if (esCopia) {
    doc.setFontSize(fs+2); doc.setFont('courier','bold')
    doc.text('='.repeat(40), margen, y); y += lh
    doc.text('*** C O P I A ***', mm/2, y, {align:'center'}); y += lh
    doc.text('='.repeat(40), margen, y); y += lh
    doc.setFont('courier','normal'); doc.setFontSize(fs)
  }

  // LOGO (solo en original)
  if (!esCopia && config.logo) {
    try {
      const logoW = mm === 80 ? 50 : 38
      const logoX = margen + (anchoUtil - logoW) / 2
      doc.addImage(config.logo, 'JPEG', logoX, y, logoW, 14)
      y += 17
    } catch(e) { console.warn('Logo error:', e) }
  }

  // NOMBRE NEGOCIO
  doc.setFontSize(fs+3); doc.setFont('courier','bold')
  doc.text(config.nombre_negocio || 'CREDITOS', mm/2, y, {align:'center'}); y += lh + 1
  doc.setFont('courier','normal'); doc.setFontSize(fs)

  if (config.slogan) { doc.text(config.slogan, mm/2, y, {align:'center'}); y += lh }
  if (config.telefono) { doc.text(config.telefono, mm/2, y, {align:'center'}); y += lh }

  // SEPARADOR
  doc.text('='.repeat(40), margen, y); y += lh
  doc.text(`Cliente: ${cliente}`, margen, y); y += lh
  const fechaStr = new Date(fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'})
  doc.text(`Ticket #${numero}  ${fechaStr}`, margen, y); y += lh
  doc.text('-'.repeat(40), margen, y); y += lh

  // PRODUCTOS
  items.forEach(item => {
    const cant = `${item.cantidad} ${item.unidad}`
    const desc = item.descripcion || ''
    const precioU = `$${parseFloat(item.precio_unitario).toLocaleString('es-MX')}`
    const sub = parseFloat(item.subtotal || item.cantidad * item.precio_unitario)
    const subStr = `$${sub.toLocaleString('es-MX')}`

    // Línea 1: cantidad + descripción
    doc.text(`${cant} ${desc}`, margen, y); y += lh
    // Línea 2: precio unitario alineado izq, subtotal alineado der
    doc.text(`  ${precioU} c/u`, margen, y)
    doc.text(subStr, xDer, y, {align:'right'})
    y += lh
  })

  // TOTAL
  doc.text('-'.repeat(40), margen, y); y += lh
  doc.setFontSize(fs+2); doc.setFont('courier','bold')
  const totalStr = `$${parseFloat(total).toLocaleString('es-MX', {minimumFractionDigits:2})}`
  doc.text('TOTAL:', margen, y)
  doc.text(totalStr, xDer, y, {align:'right'})
  y += lh + 1

  doc.setFontSize(fs); doc.setFont('courier','normal')
  doc.text('='.repeat(40), margen, y); y += lh

  if (config.pie) { doc.text(config.pie, mm/2, y, {align:'center'}); y += lh }

  // PAGARÉ
  y += 2
  doc.text('-'.repeat(40), margen, y); y += lh
  const negocio = config.nombre_negocio || 'el beneficiario'
  const totalFmt = `$${parseFloat(total).toLocaleString('es-MX',{minimumFractionDigits:2})}`
  const totalLetras = numALetras(parseFloat(total))

  doc.setFontSize(fs - 0.5)
  const textoPagere = [
    `Debo y pagare a la orden de ${negocio}`,
    `en esta ciudad o en cualquier otra`,
    `que se me requiera la cantidad de`,
    `${totalFmt} (${totalLetras})`,
    `valor de la mercancia arriba descrita`,
    `y que he recibido a mi entera`,
    `satisfaccion. Este pagare es mercantil`,
    `y esta regido por la Ley General de`,
    `Titulos y Operaciones de Credito`,
    `en su articulo 173.`,
  ]
  textoPagere.forEach(t => { doc.text(t, margen, y); y += lh - 0.2 })

  doc.setFontSize(fs)
  y += 3
  doc.text(`Nombre: ______________________________`, margen, y); y += lh + 4
  doc.text(`Firma:  ______________________________`, margen, y); y += lh + 2
  doc.text('-'.repeat(40), margen, y); y += lh

  return y
}

export async function imprimirTicketVenta({ numero, cliente, fecha, items, total, config = {} }) {
  const { jsPDF } = await import('jspdf')
  const mm = getMM(config)
  const margen = 2
  const fs = parseFloat(config.font_size) || (mm === 80 ? 8 : 7)
  const lh = fs * 0.68

  // Primera pasada para medir altura total
  const docTemp = new jsPDF({ unit: 'mm', format: [mm, 500], orientation: 'portrait' })
  docTemp.setFont('courier', 'normal')
  let y = 6
  y = dibujarBloque(docTemp, config, numero, cliente, fecha, items, total, mm, margen, fs, lh, false, y)
  y += 6
  y = dibujarBloque(docTemp, config, numero, cliente, fecha, items, total, mm, margen, fs, lh, true, y)
  const alturaFinal = y + 10

  // Segunda pasada con altura exacta
  const doc = new jsPDF({ unit: 'mm', format: [mm, alturaFinal], orientation: 'portrait' })
  doc.setFont('courier', 'normal')
  let y2 = 6
  y2 = dibujarBloque(doc, config, numero, cliente, fecha, items, total, mm, margen, fs, lh, false, y2)
  y2 += 6
  dibujarBloque(doc, config, numero, cliente, fecha, items, total, mm, margen, fs, lh, true, y2)

  doc.save(`Ticket_${numero}_${cliente.replace(/\s/g,'_')}.pdf`)
}
