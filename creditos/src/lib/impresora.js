// ─── Configuración de impresora ───────────────────────────────────────────────
const NOMBRE_IMPRESORA = 'BlueTooth Printer'
const ANCHO_TICKET = 32 // caracteres por línea en 58mm

// ─── Helpers de formato ───────────────────────────────────────────────────────
function linea(char = '-') { return char.repeat(ANCHO_TICKET) }

function centrar(texto) {
  const espacios = Math.max(0, Math.floor((ANCHO_TICKET - texto.length) / 2))
  return ' '.repeat(espacios) + texto
}

function dosColumnas(izq, der) {
  const espacio = ANCHO_TICKET - izq.length - der.length
  return izq + ' '.repeat(Math.max(1, espacio)) + der
}

function truncar(texto, max) {
  return texto.length > max ? texto.slice(0, max - 1) + '.' : texto
}

// ─── Conectar con QZ Tray ─────────────────────────────────────────────────────
async function conectar() {
  if (!window.qz) throw new Error('QZ Tray no está instalado o no está corriendo')
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect()
  }
}

// ─── Imprimir ticket de venta ─────────────────────────────────────────────────
export async function imprimirTicketVenta(ticket) {
  await conectar()
  const { numero, cliente, fecha, items, total } = ticket
  const fechaStr = new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })

  const datos = [
    '\x1B\x40',           // inicializar impresora
    '\x1B\x61\x01',       // centrar
    '\x1B\x21\x30',       // fuente grande
    'CREDITOS\n',
    '\x1B\x21\x00',       // fuente normal
    '\x1B\x61\x00',       // alinear izquierda
    linea('=') + '\n',
    `Cliente: ${truncar(cliente, 24)}\n`,
    `Ticket #${numero}  Fecha: ${fechaStr}\n`,
    linea('-') + '\n',
  ]

  items.forEach(item => {
    const cant = `${item.cantidad} ${item.unidad}`
    const precio = `$${parseFloat(item.precio_unitario).toLocaleString('es-MX')}`
    const desc = truncar(item.descripcion, ANCHO_TICKET - precio.length - 1)
    datos.push(`${cant} ${desc}\n`)
    datos.push(dosColumnas('', precio) + '\n')
  })

  datos.push(linea('-') + '\n')
  datos.push('\x1B\x21\x10')  // fuente mediana
  datos.push(dosColumnas('TOTAL:', `$${parseFloat(total).toLocaleString('es-MX')}`) + '\n')
  datos.push('\x1B\x21\x00')  // fuente normal
  datos.push(linea('=') + '\n')
  datos.push('\x1B\x61\x01')  // centrar
  datos.push('Gracias por su compra\n')
  datos.push('\x1B\x61\x00')  // izquierda
  datos.push('\n\n\n')         // espacio para corte
  datos.push('\x1D\x56\x41\x03') // corte parcial

  const config = qz.configs.create(NOMBRE_IMPRESORA)
  await qz.print(config, datos)
}

// ─── Imprimir concentrado cliente/proveedor ───────────────────────────────────
export async function imprimirConcentrado({ tipo, nombre, compras, abonos, totalComprado, totalAbonado, saldo }) {
  await conectar()
  const fechaStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })

  const datos = [
    '\x1B\x40',
    '\x1B\x61\x01',
    '\x1B\x21\x30',
    'CREDITOS\n',
    '\x1B\x21\x00',
    '\x1B\x61\x00',
    linea('=') + '\n',
    `${tipo}: ${truncar(nombre, ANCHO_TICKET - tipo.length - 2)}\n`,
    `Emitido: ${fechaStr}\n`,
    linea('-') + '\n',
    'COMPRAS:\n',
  ]

  compras.forEach(c => {
    const fecha = new Date(c.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
    const desc = truncar(c.descripcion || 'Compra', 18)
    const monto = `$${parseFloat(c.total).toLocaleString('es-MX')}`
    datos.push(dosColumnas(`${fecha} ${desc}`, monto) + '\n')
  })

  datos.push(linea('-') + '\n')
  datos.push(dosColumnas('TOTAL COMPRADO:', `$${totalComprado.toLocaleString('es-MX')}`) + '\n')
  datos.push(linea('-') + '\n')
  datos.push('ABONOS:\n')

  abonos.forEach(a => {
    const fecha = new Date(a.creado_en).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
    const tipo = a.forma_pago === 'transferencia' ? 'Transfer.' : a.forma_pago === 'efectivo' ? 'Efectivo' : 'Deposito'
    const monto = `$${parseFloat(a.monto).toLocaleString('es-MX')}`
    datos.push(dosColumnas(`${fecha} ${tipo}`, monto) + '\n')
  })

  datos.push(linea('-') + '\n')
  datos.push(dosColumnas('TOTAL ABONADO:', `$${totalAbonado.toLocaleString('es-MX')}`) + '\n')
  datos.push(linea('=') + '\n')
  datos.push('\x1B\x21\x10')
  datos.push(dosColumnas('SALDO PENDIENTE:', `$${saldo.toLocaleString('es-MX')}`) + '\n')
  datos.push('\x1B\x21\x00')
  datos.push(linea('=') + '\n')
  datos.push('\n\n\n')
  datos.push('\x1D\x56\x41\x03')

  const config = qz.configs.create(NOMBRE_IMPRESORA)
  await qz.print(config, datos)
}
