// Base de datos local (SQLite). Todo se guarda en la laptop (carpeta data/).
// Usa el SQLite integrado de Node (node:sqlite): no hay que instalar ni compilar nada.
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, 'redsos.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS solicitudes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo        TEXT UNIQUE,
    tipo          TEXT NOT NULL,
    sector        TEXT NOT NULL,
    urgencia      TEXT NOT NULL CHECK (urgencia IN ('alta','media','baja')),
    detalle       TEXT,
    estado        TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','en_atencion','resuelta')),
    asignado_a    TEXT,                         -- nombre del brigadista que la atiende
    creada_en     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    sincronizado  INTEGER NOT NULL DEFAULT 0    -- 0 = falta subir a Firebase (Sprint 3)
  );

  CREATE TABLE IF NOT EXISTS brigadistas (
    usuario     TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    clave_hash  TEXT NOT NULL
  );
`);

// Migración: bases creadas en el Sprint 1 no tienen la columna asignado_a
const columnas = db.prepare('PRAGMA table_info(solicitudes)').all().map((c) => c.name);
if (!columnas.includes('asignado_a')) {
  db.exec('ALTER TABLE solicitudes ADD COLUMN asignado_a TEXT');
}

// ---- Contraseñas (scrypt, incluido en Node) ----
function hashClave(clave) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(clave, sal, 32).toString('hex');
  return `${sal}:${hash}`;
}
function verificarClave(clave, guardada) {
  const [sal, hash] = guardada.split(':');
  const calculado = crypto.scryptSync(clave, sal, 32);
  const esperado = Buffer.from(hash, 'hex');
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

// ---- Solicitudes ----
const insertar = db.prepare(`
  INSERT INTO solicitudes (tipo, sector, urgencia, detalle)
  VALUES (@tipo, @sector, @urgencia, @detalle)
`);
const ponerCodigo = db.prepare(`UPDATE solicitudes SET codigo = ? WHERE id = ?`);
const porCodigo = db.prepare(`SELECT * FROM solicitudes WHERE codigo = ?`);
const cambiarEstado = db.prepare(`
  UPDATE solicitudes SET estado = ?, asignado_a = ?, sincronizado = 0 WHERE codigo = ?
`);

// Las resueltas al final; luego urgencia alta primero; luego la más antigua primero.
const listar = db.prepare(`
  SELECT * FROM solicitudes
  ORDER BY
    CASE estado WHEN 'resuelta' THEN 1 ELSE 0 END,
    CASE urgencia WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
    creada_en ASC, id ASC
`);

const resumen = db.prepare(`
  SELECT
    COALESCE(SUM(estado = 'pendiente'), 0)   AS pendientes,
    COALESCE(SUM(estado = 'en_atencion'), 0) AS en_atencion,
    COALESCE(SUM(estado = 'resuelta'), 0)    AS resueltas,
    COUNT(*)                                 AS total
  FROM solicitudes
`);

function crear(datos) {
  db.exec('BEGIN');
  try {
    const { lastInsertRowid } = insertar.run(datos);
    const codigo = 'RS-' + String(lastInsertRowid).padStart(4, '0');
    ponerCodigo.run(codigo, lastInsertRowid);
    db.exec('COMMIT');
    return { ...porCodigo.get(codigo) };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---- Brigadistas ----
const buscarBrigadista = db.prepare(`SELECT * FROM brigadistas WHERE usuario = ?`);
const guardarBrigadista = db.prepare(`
  INSERT INTO brigadistas (usuario, nombre, clave_hash) VALUES (?, ?, ?)
  ON CONFLICT(usuario) DO UPDATE SET nombre = excluded.nombre, clave_hash = excluded.clave_hash
`);

function crearBrigadista(usuario, nombre, clave) {
  guardarBrigadista.run(usuario.toLowerCase(), nombre, hashClave(clave));
}

// Si no hay ningún brigadista, crea uno de demostración
if (db.prepare('SELECT COUNT(*) AS n FROM brigadistas').get().n === 0) {
  crearBrigadista('brigadista', 'Brigadista', 'redsos123');
  console.warn('[RedSOS] Se creó el usuario de demo "brigadista" / "redsos123". ' +
               'Crea los reales con: npm run brigadista -- usuario "Nombre" clave');
}

module.exports = {
  crear,
  buscarPorCodigo: (codigo) => porCodigo.get(codigo),
  actualizar: (codigo, estado, asignadoA) => {
    cambiarEstado.run(estado, asignadoA, codigo);
    return { ...porCodigo.get(codigo) };
  },
  listar: () => listar.all().map((s) => ({ ...s })),
  resumen: () => ({ ...resumen.get() }),
  crearBrigadista,
  buscarBrigadista: (usuario) => buscarBrigadista.get(usuario),
  verificarClave,
};
