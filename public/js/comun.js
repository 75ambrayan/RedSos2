// Utilidades compartidas
const ETIQUETA_TIPO = {
  agua: 'Agua', alimentos: 'Alimentos', medicamentos: 'Medicamentos',
  persona_herida: 'Persona herida', otro: 'Otro',
};
const ETIQUETA_ESTADO = {
  pendiente: 'Pendiente', en_atencion: 'En atención', resuelta: 'Resuelta',
};

// Muestra "Modo sin Internet" o "Con Internet" en la insignia de la barra
async function actualizarInsignia() {
  const el = document.getElementById('insignia-red');
  if (!el) return;
  try {
    const r = await fetch('/api/estado');
    const { internet } = await r.json();
    el.textContent = internet ? 'Con Internet' : 'Modo sin Internet';
    el.className = 'badge ' + (internet ? 'text-bg-success' : 'text-bg-warning');
  } catch {
    el.textContent = 'Sin conexión al servidor';
    el.className = 'badge text-bg-danger';
  }
}
actualizarInsignia();
setInterval(actualizarInsignia, 15000);
