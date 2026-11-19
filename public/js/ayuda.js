const form = document.getElementById('form');
const errorBox = document.getElementById('error');
const boton = document.getElementById('enviar');

function mostrarError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('d-none');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.classList.add('d-none');

  const tipo = form.querySelector('input[name="tipo"]:checked');
  const urgencia = form.querySelector('input[name="urgencia"]:checked');
  const sector = document.getElementById('sector').value.trim();
  const detalle = document.getElementById('detalle').value.trim();

  if (!tipo) return mostrarError('Elige qué necesitas.');
  if (!sector) return mostrarError('Indica tu sector o ubicación.');
  if (!urgencia) return mostrarError('Indica qué tan urgente es.');

  boton.disabled = true;
  try {
    const r = await fetch('/api/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: tipo.value, sector, urgencia: urgencia.value, detalle }),
    });
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.error || 'No se pudo enviar.');

    document.getElementById('codigo').textContent = datos.codigo;
    form.classList.add('d-none');
    document.getElementById('confirmacion').classList.remove('d-none');
  } catch (err) {
    mostrarError(err.message);
    boton.disabled = false;
  }
});
