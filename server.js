// RedSOS - servidor local (Express). Corre en la laptop del punto de ayuda.
const express = require('express');
const path = require('path');
const dns = require('dns');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const TIPOS = ['agua', 'alimentos', 'medicamentos', 'persona_herida', 'otro'];
const URGENCIAS = ['alta', 'media', 'baja'];

// Sesiones de brigadistas (en memoria: si se reinicia el servidor, hay que volver a entrar)
const sesiones = new Map();
const DURACION_SESION = 12 * 60 * 60 * 1000;

function requiereBrigadista(req, res, next) {
  const cabecera = req.get('authorization') || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  const sesion = sesiones.get(token);
  if (!sesion || sesion.exp < Date.now()) {
    sesiones.delete(token);
    return res.status(401).json({ error: 'Inicia sesión como brigadista.' });
  }
  req.token = token;
  req.brigadista = sesion;
  next();
}

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Bootstrap se sirve desde la propia laptop (sin CDN, porque no hay Internet).
app.use('/vendor/bootstrap',
  express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));

// US-02/03/04/05: registrar una solicitud de ayuda
app.post('/api/solicitudes', (req, res) => {
  const tipo = String(req.body.tipo || '').trim();
  const sector = String(req.body.sector || '').trim();
  const urgencia = String(req.body.urgencia || '').trim();
  const detalle = String(req.body.detalle || '').trim().slice(0, 300);

  if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Elige qué necesitas.' });
  if (!sector) return res.status(400).json({ error: 'Indica tu sector o ubicación.' });
  if (sector.length > 80) return res.status(400).json({ error: 'El sector es demasiado largo.' });
  if (!URGENCIAS.includes(urgencia)) return res.status(400).json({ error: 'Indica la urgencia.' });

  const solicitud = db.crear({ tipo, sector, urgencia, detalle });
  res.status(201).json(solicitud);
});

// US-06: lista para el brigadista (urgentes primero)
app.get('/api/solicitudes', requiereBrigadista, (req, res) => {
  res.json(db.listar());
});

// Consulta de estado por código (para el ciudadano)
app.get('/api/solicitudes/:codigo', (req, res) => {
  const s = db.buscarPorCodigo(String(req.params.codigo).toUpperCase());
  if (!s) return res.status(404).json({ error: 'No encontramos ese código.' });
  res.json({ codigo: s.codigo, tipo: s.tipo, sector: s.sector,
             urgencia: s.urgencia, estado: s.estado, creada_en: s.creada_en });
});

// US-09: login del brigadista
app.post('/api/login', async (req, res) => {
  const usuario = String(req.body.usuario || '').trim().toLowerCase();
  const clave = String(req.body.clave || '');
  const b = db.buscarBrigadista(usuario);
  if (!b || !db.verificarClave(clave, b.clave_hash)) {
    await new Promise((r) => setTimeout(r, 500)); // frena intentos repetidos
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sesiones.set(token, { usuario: b.usuario, nombre: b.nombre, exp: Date.now() + DURACION_SESION });
  res.json({ token, nombre: b.nombre });
});

app.post('/api/logout', requiereBrigadista, (req, res) => {
  sesiones.delete(req.token);
  res.json({ ok: true });
});

// US-07/08: el brigadista toma, resuelve o reabre una solicitud
app.patch('/api/solicitudes/:codigo', requiereBrigadista, (req, res) => {
  const codigo = String(req.params.codigo).toUpperCase();
  const accion = String(req.body.accion || '');
  const s = db.buscarPorCodigo(codigo);
  if (!s) return res.status(404).json({ error: 'No existe esa solicitud.' });

  if (accion === 'tomar') {
    if (s.estado !== 'pendiente') {
      return res.status(409).json({
        error: `Esta solicitud ya la tomó ${s.asignado_a || 'otro brigadista'}.` });
    }
    return res.json(db.actualizar(codigo, 'en_atencion', req.brigadista.nombre));
  }
  if (accion === 'resolver') {
    if (s.estado !== 'en_atencion') {
      return res.status(409).json({ error: 'Solo se puede resolver una solicitud en atención.' });
    }
    return res.json(db.actualizar(codigo, 'resuelta', s.asignado_a));
  }
  if (accion === 'reabrir') {
    if (s.estado === 'pendiente') {
      return res.status(409).json({ error: 'La solicitud ya está pendiente.' });
    }
    return res.json(db.actualizar(codigo, 'pendiente', null));
  }
  res.status(400).json({ error: 'Acción no válida.' });
});

// Datos para que la gente se conecte: red Wi-Fi y direcciones de esta laptop
const WIFI_NOMBRE = process.env.REDSOS_WIFI || 'RedSOS';
const WIFI_CLAVE = process.env.REDSOS_WIFI_CLAVE || ''; // vacío = red abierta

function direccionesLocales() {
  const ips = [];
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
    }
  }
  // El hotspot de Windows usa 192.168.137.x: va primero
  return ips.sort((a, b) => Number(b.startsWith('192.168.137.')) - Number(a.startsWith('192.168.137.')));
}

app.get('/api/info', (req, res) => {
  const urls = direccionesLocales().map((ip) => `http://${ip}:${PORT}`);
  const wifi = WIFI_CLAVE
    ? `WIFI:T:WPA;S:${WIFI_NOMBRE};P:${WIFI_CLAVE};;`
    : `WIFI:T:nopass;S:${WIFI_NOMBRE};;`;
  res.json({ red: WIFI_NOMBRE, clave: WIFI_CLAVE, urls, wifi });
});

// QR en SVG de cualquier texto corto (Wi-Fi o URL)
app.get('/api/qr.svg', async (req, res) => {
  const texto = String(req.query.t || '').slice(0, 200);
  if (!texto) return res.status(400).end();
  res.type('image/svg+xml').send(await QRCode.toString(texto, { type: 'svg', margin: 1 }));
});

// Contadores del panel
app.get('/api/resumen', requiereBrigadista, (req, res) => {
  res.json(db.resumen());
});

// Indicador "Modo sin Internet" / "Con Internet" (base para la sincronización del Sprint 3)
app.get('/api/estado', (req, res) => {
  const t = setTimeout(() => res.json({ internet: false }), 1500);
  dns.resolve('firebase.google.com', (err) => {
    clearTimeout(t);
    if (!res.headersSent) res.json({ internet: !err });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n  RedSOS está funcionando.');
  console.log(`  Red Wi-Fi: ${WIFI_NOMBRE}${WIFI_CLAVE ? ' (clave: ' + WIFI_CLAVE + ')' : ' (abierta)'}`);
  direccionesLocales().forEach((ip) => console.log(`  Celulares: http://${ip}:${PORT}`));
  console.log(`  Esta laptop: http://localhost:${PORT}/conectar.html\n`);
});
