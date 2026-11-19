// Crea o actualiza un brigadista:
//   npm run brigadista -- jperez "Juan Pérez" miClave123
const db = require('../db');
const [usuario, nombre, clave] = process.argv.slice(2);
if (!usuario || !nombre || !clave) {
  console.log('Uso: npm run brigadista -- usuario "Nombre completo" clave');
  process.exit(1);
}
db.crearBrigadista(usuario, nombre, clave);
console.log(`Brigadista "${usuario}" (${nombre}) guardado.`);
