const ANCHO58 = 32
const ANCHO80 = 46

function getAncho(config) { return config.ancho === '80' ? ANCHO80 : ANCHO58 }
function getMM(config) { return config.ancho === '80' ? 80 : 58 }
function linea(c, ancho) { return (c || '-').repeat(ancho || ANCHO58) }
function dosCol(iz, de, ancho) { ancho = ancho || ANCHO58; return iz + ' '.repeat(Math.max(1, ancho - iz.length - de.length)) + de }
function truncar(t, max) { return t && t.length > max ? t.slice(0, max - 1) + '.' : (t || '') }

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
  if (entero >= 1000) { const miles = Math.floor(entero/1000); const resto = entero%1000; resultado = (miles===1?'MIL':convertir(miles)+' MIL')+(resto>0?' '+convertir(resto):'') }
  else { resultado = convertir(entero) }
  return resultado+' '+centavos+'/100 M.N.'
}

function dibujarBloque(doc, config, numero, cliente, fecha, items, total, ancho, mm, margen, fs, lh, esCopia, yInicio) {
  let y = yInicio

  doc.setFontSize(fs); doc.setFont('courier', 'normal')

  if (esCopia) {
    doc.setFontSize(fs+2); doc.setFont('courier','bold')
    doc.text(linea('=',ancho), margen, y); y+=lh
    doc.text('*** C O P I A ***', (mm/2)+margen, y, {align:'center'}); y+=lh
    doc.text(linea('=',ancho), margen, y); y+=lh
    doc.setFont('courier','normal'); doc.setFontSize(fs)
  }

  if (!esCopia && config.logo) {
    try { doc.addImage(config.logo,'JPEG',margen+(mm===80?10:4),y,mm===80?60:46,16); y+=19 } catch(e){}
  }

  doc.setFontSize(fs+3); doc.setFont('courier','bold')
  doc.text(config.nombre_negocio||'CREDITOS', (mm/2)+margen, y, {align:'center'}); y+=lh+1
  doc.setFont('courier','normal'); doc.setFontSize(fs)

  if (config.slogan) { doc.text(config.slogan,(mm/2)+margen,y,{align:'center'}); y+=lh }
  if (config.telefono) { doc.text(config.telefono,(mm/2)+margen,y,{align:'center'}); y+=lh }

  doc.text(linea('=',ancho),margen,y); y+=lh
  doc.text(`Cliente: ${truncar(cliente,ancho-9)}`,margen,y); y+=lh
  const fechaStr = new Date(fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'})
  doc.text(`Ticket #${numero}  ${fechaStr}`,margen,y); y+=lh
  doc.text(linea('-',ancho),margen,y); y+=lh

  items.forEach(item => {
    const cant = `${item.cantidad} ${item.unidad}`
    const desc = truncar(item.descripcion, ancho-2)
    const precioU = `$${parseFloat(item.precio_unitario).toLocaleString('es-MX')}`
    const sub = `$${parseFloat(item.subtotal||item.cantidad*item.precio_unitario).toLocaleString('es-MX')}`
    doc.text(`${cant} ${desc}`,margen,y); y+=lh
    doc.text(dosCol(`  ${precioU} c/u`,sub,ancho),margen,y); y+=lh
  })

  doc.text(linea('-',ancho),margen,y); y+=lh
  doc.setFontSize(fs+1); doc.setFont('courier','bold')
  doc.text(dosCol('TOTAL:',`$${parseFloat(total).toLocaleString('es-MX')}`,ancho),margen,y); y+=lh+1
  doc.setFontSize(fs); doc.setFont('courier','normal')
  doc.text(linea('=',ancho),margen,y); y+=lh
  if (config.pie) { doc.text(config.pie,(mm/2)+margen,y,{align:'center'}); y+=lh; doc.text(linea('=',ancho),margen,y); y+=lh }

  // Pagaré
  y+=2
  doc.text(linea('-',ancho),margen,y); y+=lh
  const negocio = config.nombre_negocio||'el beneficiario'
  const totalLetras = numALetras(parseFloat(total))
  const totalFmt = `$${parseFloat(total).toLocaleString('es-MX',{minimumFractionDigits:2})}`
  const texto = [
    `Debo y pagare a la orden de`,
    `${truncar(negocio,ancho)} en esta`,
    `ciudad o en cualquier otra que`,
    `se me requiera la cantidad de`,
    `${totalFmt}`,
    `(${truncar(totalLetras,ancho)})`,
    `valor de la mercancia arriba`,
    `descrita y que he recibido a mi`,
    `entera satisfaccion. Este pagare`,
    `es mercantil y esta regido por`,
    `la Ley General de Titulos y`,
    `Operaciones de Credito Art.173.`,
  ]
  doc.setFontSize(fs-0.5)
  texto.forEach(t => { doc.text(t,margen,y); y+=lh-0.3 })
  doc.setFontSize(fs)
  y+=2
  doc.text(`Nombre: ${'_'.repeat(ancho-8)}`,margen,y); y+=lh+3
  doc.text(`Firma:  ${'_'.repeat(ancho-8)}`,margen,y); y+=lh+2
  doc.text(linea('-',ancho),margen,y); y+=lh

  return y
}

export async function imprimirTicketVenta({ numero, cliente, fecha, items, total, config = {} }) {
  const { jsPDF } = await import('jspdf')
  const mm = getMM(config)
  const ancho = getAncho(config)
  const margen = 2
  const fs = parseFloat(config.font_size) || (mm === 80 ? 8 : 7)
  const lh = fs * 0.65

  // Primera pasada para calcular altura
  const docTemp = new jsPDF({ unit: 'mm', format: [mm, 500], orientation: 'portrait' })
  docTemp.setFont('courier','normal')
  let y = 6
  y = dibujarBloque(docTemp, config, numero, cliente, fecha, items, total, ancho, mm, margen, fs, lh, false, y)
  y += 4
  y = dibujarBloque(docTemp, config, numero, cliente, fecha, items, total, ancho, mm, margen, fs, lh, true, y)
  const alturaFinal = y + 8

  // Segunda pasada con altura exacta
  const doc = new jsPDF({ unit: 'mm', format: [mm, alturaFinal], orientation: 'portrait' })
  doc.setFont('courier','normal')
  let y2 = 6
  y2 = dibujarBloque(doc, config, numero, cliente, fecha, items, total, ancho, mm, margen, fs, lh, false, y2)
  y2 += 4
  dibujarBloque(doc, config, numero, cliente, fecha, items, total, ancho, mm, margen, fs, lh, true, y2)

  doc.save(`Ticket_${numero}_${cliente.replace(/\s/g,'_')}.pdf`)
}
