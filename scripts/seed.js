// Carga solicitudes de ejemplo para la demo: npm run seed
const db = require('../db');

const ejemplos = [
  { tipo: 'persona_herida', sector: 'Sector Norte', urgencia: 'alta',  detalle: 'Adulto mayor con golpe en la pierna' },
  { tipo: 'agua',           sector: 'Barrio San Juan', urgencia: 'alta', detalle: 'Sin agua desde ayer, hay niños' },
  { tipo: 'medicamentos',   sector: 'Sector Centro', urgencia: 'media', detalle: 'Necesita insulina' },
  { tipo: 'alimentos',      sector: 'Barrio San Juan', urgencia: 'media', detalle: '' },
  { tipo: 'alimentos',      sector: 'Sector Sur', urgencia: 'baja', detalle: 'Faltan víveres para 3 días' },
  { tipo: 'otro',           sector: 'Sector Norte', urgencia: 'baja', detalle: 'Necesitamos frazadas' },
];
ejemplos.forEach((e) => console.log('Creada', db.crear(e).codigo));
