// ══════════════════════════════════════════════════════════════
// ticketPDF.js — generador de tickets térmicos (58/80mm)
// Todas las medidas son configurables desde "Configurar ticket".
// ══════════════════════════════════════════════════════════════

function numero(v, def) { const n = parseFloat(v); return isNaN(n) ? def : n }
function getMM(config) { return String(config.ancho) === '80' ? 80 : 58 }
// Ancho aproximado de un caracter Courier en mm (0.6 em; 1pt = 0.352778mm)
function charW(fs) { return fs * 0.6 * 0.352778 }

function numALetras(valor) {
  const partes = valor.toFixed(2).split('.')
  const entero = parseInt(partes[0])
  const centavos = partes[1]
  const u = ['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE','VEINTIUN','VEINTIDOS','VEINTITRES','VEINTICUATRO','VEINTICINCO','VEINTISEIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE']
  const d = ['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA']
  const c = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS']
  function conv(n) {
    if (n === 0) return ''; if (n === 100) return 'CIEN'
    if (n < 30) return u[n]
    if (n < 100) { const dd = Math.floor(n/10); const uu = n%10; return uu === 0 ? d[dd] : d[dd]+' Y '+u[uu] }
    const cc = Math.floor(n/100); const r = n%100
    return c[cc]+(r > 0 ? ' '+conv(r) : '')
  }
  let res = ''
  if (entero >= 1000000) { const m = Math.floor(entero/1000000); const r = entero%1000000; res = (m === 1 ? 'UN MILLON' : conv(m)+' MILLONES')+(r > 0 ? ' '+conv(Math.floor(r/1000))+(r%1000 > 0 ? ' '+conv(r%1000) : '') : '') }
  else if (entero >= 1000) { const m = Math.floor(entero/1000); const r = entero%1000; res = (m === 1 ? 'MIL' : conv(m)+' MIL')+(r > 0 ? ' '+conv(r) : '') }
  else { res = conv(entero) }
  return res+' '+centavos+'/100 M.N.'
}

// Parte texto en líneas de máximo maxChars caracteres (por palabras)
function partir(texto, maxChars) {
  const palabras = String(texto).split(' ')
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

// Lee la config y aplica valores por defecto a todas las medidas
function opciones(config) {
  const mm = getMM(config)
  const fs = numero(config.font_size, mm === 80 ? 8 : 7)
  return {
    mm, fs,
    lh: fs * numero(config.interlineado, 0.35),
    margenIzq: numero(config.margen_izq, 2),
    margenDer: numero(config.margen_der, 2),
    margenSup: numero(config.margen_sup, 2),
    logoAncho: numero(config.logo_ancho, mm === 80 ? 48 : 36),
    logoAlto: numero(config.logo_alto, 13),
    logoAlign: config.logo_align || 'centro',
    logoEnCopia: !!config.logo_en_copia,
    altoMax: numero(config.alto_max, 280),
  }
}

// Contexto de escritura con salto de página automático
function crearCtx(doc, o, paginar, altoPagina) {
  return {
    doc, o, paginar, altoPagina,
    y: o.margenSup + 3,
    maxY: altoPagina - 5,
    salto(necesita) {
      if (this.paginar && this.y + (necesita || 0) > this.maxY) {
        this.doc.addPage([o.mm, this.altoPagina])
        this.y = o.margenSup + 3
      }
    },
    linea(txt, x, opts, avance) {
      this.salto(this.o.lh)
      this.doc.text(txt, x, this.y, opts || undefined)
      this.y += (avance !== undefined ? avance : this.o.lh)
    },
    espacio(a) { this.y += a },
  }
}

// Dibuja un bloque completo de ticket (original o copia)
function dibujarBloque(ctx, config, d, esCopia) {
  const { doc, o } = ctx
  const anchoUtil = o.mm - o.margenIzq - o.margenDer
  const xDer = o.mm - o.margenDer
  const xCentro = o.margenIzq + anchoUtil / 2
  const nSep = Math.max(10, Math.floor(anchoUtil / charW(o.fs)))
  const sep = (c) => c.repeat(nSep)

  doc.setFontSize(o.fs); doc.setFont('courier', 'normal')

  if (esCopia) {
    const nSep2 = Math.max(10, Math.floor(anchoUtil / charW(o.fs + 2)))
    doc.setFontSize(o.fs + 2); doc.setFont('courier', 'bold')
    ctx.linea('='.repeat(nSep2), o.margenIzq)
    ctx.linea('*** C O P I A ***', xCentro, { align: 'center' })
    ctx.linea('='.repeat(nSep2), o.margenIzq)
    doc.setFont('courier', 'normal'); doc.setFontSize(o.fs)
  }

  // Logo (medidas y posición configurables)
  if (config.logo && (!esCopia || o.logoEnCopia)) {
    try {
      const tipo = String(config.logo).startsWith('data:image/png') ? 'PNG' : 'JPEG'
      let x = o.margenIzq
      if (o.logoAlign === 'centro') x = o.margenIzq + (anchoUtil - o.logoAncho) / 2
      else if (o.logoAlign === 'derecha') x = xDer - o.logoAncho
      ctx.salto(o.logoAlto + 3)
      doc.addImage(config.logo, tipo, x, Math.max(1, ctx.y - o.lh * 0.6), o.logoAncho, o.logoAlto)
      ctx.y += o.logoAlto + 2
    } catch (e) { /* logo inválido: se omite */ }
  }

  // Encabezado
  doc.setFontSize(o.fs + 3); doc.setFont('courier', 'bold')
  ctx.linea(config.nombre_negocio || 'CREDITOS', xCentro, { align: 'center' }, o.lh + 1)
  doc.setFont('courier', 'normal'); doc.setFontSize(o.fs)
  if (config.slogan) ctx.linea(config.slogan, xCentro, { align: 'center' })
  if (config.telefono) ctx.linea(config.telefono, xCentro, { align: 'center' })

  ctx.linea(sep('='), o.margenIzq)
  partir(`Cliente: ${d.cliente}`, nSep).forEach(l => ctx.linea(l, o.margenIzq))
  const fStr = new Date(d.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
  ctx.linea(`Ticket #${d.numero}  ${fStr}`, o.margenIzq)
  ctx.linea(sep('-'), o.margenIzq)

  // Productos (descripciones largas se parten en varias líneas)
  d.items.forEach(item => {
    const lineaProd = config.mostrar_unidad
      ? `${item.cantidad} ${item.unidad} ${item.descripcion || ''}`
      : `${item.cantidad} ${item.descripcion || ''}`
    partir(lineaProd, nSep).forEach(l => ctx.linea(l, o.margenIzq))
    const pu = `  $${parseFloat(item.precio_unitario).toLocaleString('es-MX')} c/u`
    const sub = `$${parseFloat(item.subtotal || item.cantidad * item.precio_unitario).toLocaleString('es-MX')}`
    ctx.salto(o.lh)
    doc.text(pu, o.margenIzq, ctx.y)
    doc.text(sub, xDer, ctx.y, { align: 'right' })
    ctx.y += o.lh
  })

  // Total
  ctx.linea(sep('-'), o.margenIzq)
  ctx.salto(o.lh + 1)
  doc.setFontSize(o.fs + 2); doc.setFont('courier', 'bold')
  doc.text('TOTAL:', o.margenIzq, ctx.y)
  doc.text(`$${parseFloat(d.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, xDer, ctx.y, { align: 'right' })
  ctx.y += o.lh + 1
  doc.setFont('courier', 'normal'); doc.setFontSize(o.fs)
  ctx.linea(sep('='), o.margenIzq)
  if (config.pie) ctx.linea(config.pie, xCentro, { align: 'center' })

  // Pagaré
  ctx.espacio(2)
  ctx.linea(sep('-'), o.margenIzq)
  const negocio = config.nombre_negocio || 'el beneficiario'
  const totalFmt = `$${parseFloat(d.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
  const letras = numALetras(parseFloat(d.total))
  const textoP = `Debo y pagare a la orden de ${negocio} en esta ciudad o en cualquier otra que se me requiera la cantidad de ${totalFmt} (${letras}) valor de la mercancia arriba descrita y que he recibido a mi entera satisfaccion. Este pagare es mercantil y esta regido por la Ley General de Titulos y Operaciones de Credito en su articulo 173.`
  partir(textoP, nSep).forEach(l => ctx.linea(l, o.margenIzq))

  ctx.espacio(3)
  const guiones = '_'.repeat(Math.max(10, nSep - 8))
  ctx.linea(`Nombre: ${guiones}`, o.margenIzq, undefined, o.lh + 4)
  ctx.linea(`Firma:  ${guiones}`, o.margenIzq, undefined, o.lh + 2)
  ctx.linea(sep('-'), o.margenIzq)
}

// Construye el documento completo (original + copia) con paginación
async function construirDoc(params) {
  const { jsPDF } = await import('jspdf')
  const config = params.config || {}
  const o = opciones(config)

  // Pasada 1: medir la altura total real
  const tmp = new jsPDF({ unit: 'mm', format: [o.mm, 3000] })
  tmp.setFont('courier', 'normal')
  const ctx1 = crearCtx(tmp, o, false, 3000)
  dibujarBloque(ctx1, config, params, false)
  ctx1.espacio(4)
  dibujarBloque(ctx1, config, params, true)
  const altoTotal = Math.ceil(ctx1.y) + 4

  let doc
  if (altoTotal <= o.altoMax) {
    // Cabe en una sola página: altura exacta (como siempre)
    doc = new jsPDF({ unit: 'mm', format: [o.mm, altoTotal] })
    doc.setFont('courier', 'normal')
    const ctx = crearCtx(doc, o, false, altoTotal)
    dibujarBloque(ctx, config, params, false)
    ctx.espacio(4)
    dibujarBloque(ctx, config, params, true)
  } else {
    // Ticket grande: se divide en páginas del alto máximo configurado
    // para que el driver de la impresora no lo recorte.
    doc = new jsPDF({ unit: 'mm', format: [o.mm, o.altoMax] })
    doc.setFont('courier', 'normal')
    const ctx = crearCtx(doc, o, true, o.altoMax)
    dibujarBloque(ctx, config, params, false)
    // La copia arranca en página nueva para un corte limpio
    doc.addPage([o.mm, o.altoMax])
    ctx.y = o.margenSup + 3
    dibujarBloque(ctx, config, params, true)
  }
  return doc
}

// Impresión rápida: abre el diálogo de imprimir directo, sin descargar
function imprimirRapido(doc, nombreArchivo) {
  try {
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.onload = () => {
      setTimeout(() => {
        try { iframe.contentWindow.focus(); iframe.contentWindow.print() }
        catch (e) { window.open(url, '_blank') }
      }, 400)
    }
    // Limpieza después de dar tiempo a imprimir
    setTimeout(() => { try { URL.revokeObjectURL(url); iframe.remove() } catch (e) {} }, 120000)
  } catch (e) {
    doc.save(nombreArchivo)
  }
}

export async function imprimirTicketVenta(params) {
  const config = params.config || {}
  const doc = await construirDoc(params)
  const nombreArchivo = `Ticket_${params.numero}_${String(params.cliente || '').replace(/\s/g, '_')}.pdf`
  if ((config.modo_impresion || 'rapido') === 'rapido') {
    imprimirRapido(doc, nombreArchivo)
  } else {
    doc.save(nombreArchivo)
  }
}

// Vista previa con datos de muestra (para "Configurar ticket")
export async function generarVistaPrevia(config = {}) {
  const items = [
    { cantidad: 12, unidad: 'caja', descripcion: 'Ciruela USA', precio_unitario: 850, subtotal: 10200 },
    { cantidad: 2, unidad: 'caja', descripcion: 'Golden', precio_unitario: 1000, subtotal: 2000 },
    { cantidad: 5, unidad: 'pieza', descripcion: 'Pera Mantequilla', precio_unitario: 900, subtotal: 4500 },
  ]
  const doc = await construirDoc({
    numero: 99, cliente: 'Cliente de Prueba', fecha: new Date().toISOString(),
    items, total: 16700, config,
  })
  return doc.output('bloburl')
}
