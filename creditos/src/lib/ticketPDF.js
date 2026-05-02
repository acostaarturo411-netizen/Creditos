function getMM(config) { return config.ancho === '80' ? 80 : 58 }

function numALetras(num) {
  const partes = num.toFixed(2).split('.')
  const entero = parseInt(partes[0])
  const centavos = partes[1]
  const u = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE','VEINTIUN','VEINTIDOS','VEINTITRES','VEINTICUATRO','VEINTICINCO','VEINTISEIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE']
  const d = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const c = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  function conv(n) {
    if (n===0) return ''; if (n===100) return 'CIEN'
    if (n<30) return u[n]
    if (n<100) { const dd=Math.floor(n/10); const uu=n%10; return uu===0?d[dd]:d[dd]+' Y '+u[uu] }
    const cc=Math.floor(n/100); const r=n%100
    return c[cc]+(r>0?' '+conv(r):'')
  }
  let res = ''
  if (entero>=1000000) { const m=Math.floor(entero/1000000); const r=entero%1000000; res=(m===1?'UN MILLON':conv(m)+' MILLONES')+(r>0?' '+conv(Math.floor(r/1000))+(r%1000>0?' '+conv(r%1000):''):'') }
  else if (entero>=1000) { const m=Math.floor(entero/1000); const r=entero%1000; res=(m===1?'MIL':conv(m)+' MIL')+(r>0?' '+conv(r):'') }
  else { res=conv(entero) }
  return res+' '+centavos+'/100 M.N.'
}

// Parte texto en líneas según caracteres máximos por línea
function partir(doc, texto, maxChars) {
  const palabras = texto.split(' ')
  const lineas = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? actual+' '+p : p
    if (prueba.length <= maxChars) { actual = prueba }
    else { if (actual) lineas.push(actual); actual = p }
  }
  if (actual) lineas.push(actual)
  return lineas
}

function dibujar(doc, config, numero, cliente, fecha, items, total, mm, margen, fs, lh, esCopia, yInicio) {
  let y = yInicio
  const xDer = mm - margen
  const anchoUtil = mm - margen*2

  doc.setFontSize(fs); doc.setFont('courier','normal')

  if (esCopia) {
    doc.setFontSize(fs+2); doc.setFont('courier','bold')
    doc.text('='.repeat(38), margen, y); y+=lh
    doc.text('*** C O P I A ***', mm/2, y, {align:'center'}); y+=lh
    doc.text('='.repeat(38), margen, y); y+=lh
    doc.setFont('courier','normal'); doc.setFontSize(fs)
  }

  if (!esCopia && config.logo) {
    try {
      const lw = mm===80 ? 48 : 36
      doc.addImage(config.logo,'JPEG', margen+(anchoUtil-lw)/2, y, lw, 13)
      y+=16
    } catch(e){}
  }

  doc.setFontSize(fs+3); doc.setFont('courier','bold')
  doc.text(config.nombre_negocio||'CREDITOS', mm/2, y, {align:'center'}); y+=lh+1
  doc.setFont('courier','normal'); doc.setFontSize(fs)
  if (config.slogan) { doc.text(config.slogan, mm/2, y, {align:'center'}); y+=lh }
  if (config.telefono) { doc.text(config.telefono, mm/2, y, {align:'center'}); y+=lh }

  doc.text('='.repeat(38), margen, y); y+=lh
  doc.text(`Cliente: ${cliente}`, margen, y); y+=lh
  const fStr = new Date(fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'})
  doc.text(`Ticket #${numero}  ${fStr}`, margen, y); y+=lh
  doc.text('-'.repeat(38), margen, y); y+=lh

  items.forEach(item => {
    doc.text(`${item.cantidad} ${item.unidad} ${item.descripcion||''}`, margen, y); y+=lh
    const pu = `  $${parseFloat(item.precio_unitario).toLocaleString('es-MX')} c/u`
    const sub = `$${parseFloat(item.subtotal||item.cantidad*item.precio_unitario).toLocaleString('es-MX')}`
    doc.text(pu, margen, y)
    doc.text(sub, xDer, y, {align:'right'}); y+=lh
  })

  doc.text('-'.repeat(38), margen, y); y+=lh
  doc.setFontSize(fs+2); doc.setFont('courier','bold')
  doc.text('TOTAL:', margen, y)
  doc.text(`$${parseFloat(total).toLocaleString('es-MX',{minimumFractionDigits:2})}`, xDer, y, {align:'right'}); y+=lh+1
  doc.setFont('courier','normal'); doc.setFontSize(fs)
  doc.text('='.repeat(38), margen, y); y+=lh
  if (config.pie) { doc.text(config.pie, mm/2, y, {align:'center'}); y+=lh }

  // PAGARÉ
  y+=2
  doc.text('-'.repeat(38), margen, y); y+=lh
  const negocio = config.nombre_negocio||'el beneficiario'
  const totalFmt = `$${parseFloat(total).toLocaleString('es-MX',{minimumFractionDigits:2})}`
  const letras = numALetras(parseFloat(total))
  const textoP = `Debo y pagare a la orden de ${negocio} en esta ciudad o en cualquier otra que se me requiera la cantidad de ${totalFmt} (${letras}) valor de la mercancia arriba descrita y que he recibido a mi entera satisfaccion. Este pagare es mercantil y esta regido por la Ley General de Titulos y Operaciones de Credito en su articulo 173.`

  doc.setFontSize(fs)
  const maxChars = mm === 80 ? 38 : 24
  const lineasP = partir(doc, textoP, maxChars)
  lineasP.forEach(l => { doc.text(l, margen, y); y+=lh-0.5 })

  doc.setFontSize(fs); y+=3
  doc.text(`Nombre: ______________________________`, margen, y); y+=lh+4
  doc.text(`Firma:  ______________________________`, margen, y); y+=lh+2
  doc.text('-'.repeat(38), margen, y); y+=lh

  return y
}

export async function imprimirTicketVenta({ numero, cliente, fecha, items, total, config={} }) {
  const { jsPDF } = await import('jspdf')
  const mm = getMM(config)
  const margen = 2
  const fs = parseFloat(config.font_size)||(mm===80?8:7)
  const lh = fs*0.68

  // Un solo documento con altura generosa — la térmica corta automáticamente
  const doc = new jsPDF({unit:'mm',format:[mm,800]})
  doc.setFont('courier','normal')
  let y = 6
  y = dibujar(doc,config,numero,cliente,fecha,items,total,mm,margen,fs,lh,false,y)
  y += 6
  dibujar(doc,config,numero,cliente,fecha,items,total,mm,margen,fs,lh,true,y)

  doc.save(`Ticket_${numero}_${cliente.replace(/\s/g,'_')}.pdf`)
}
