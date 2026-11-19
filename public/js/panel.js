const COLOR_ESTADO = { pendiente: 'text-bg-secondary', en_atencion: 'text-bg-primary', resuelta: 'text-bg-success' };

const vistaLogin = document.getElementById('vista-login');
const vistaPanel = document.getElementById('vista-panel');
const lista = document.getElementById('lista');
const vacio = document.getElementById('vacio');
const aviso = document.getElementById('aviso');
let temporizador = null;
let ultimas = [];                  // últimas solicitudes recibidas (para filtrar sin pedirlas otra vez)
const abiertas = new Set();        // tarjetas con el detalle desplegado
let vistos = null;                 // códigos ya conocidos (null = primera carga, no suena alerta)
let audio = null;                  // se crea al tocar "Activar alertas" (el navegador lo exige)
const INTERVALO = 3000;

// ---------- sesión ----------
const guardarSesion = (token, nombre) => {
  localStorage.setItem('redsos_token', token);
  localStorage.setItem('redsos_nombre', nombre);
};
const token = () => localStorage.getItem('redsos_token');

function mostrarLogin() {
  clearInterval(temporizador);
  vistos = null;
  localStorage.removeItem('redsos_token');
  localStorage.removeItem('redsos_nombre');
  vistaPanel.classList.add('d-none');
  vistaLogin.classList.remove('d-none');
}

function mostrarPanel() {
  document.getElementById('nombre-brigadista').textContent = localStorage.getItem('redsos_nombre') || '';
  vistaLogin.classList.add('d-none');
  vistaPanel.classList.remove('d-none');
  refrescar();
  clearInterval(temporizador);
  temporizador = setInterval(refrescar, INTERVALO);
}

// fetch con el token; si la sesión venció, vuelve al login
async function api(url, opciones = {}) {
  const r = await fetch(url, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
  });
  if (r.status === 401) { mostrarLogin(); throw new Error('Sesión vencida'); }
  const datos = await r.json();
  if (!r.ok) throw new Error(datos.error || 'Error');
  return datos;
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('error-login');
  err.classList.add('d-none');
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario: document.getElementById('usuario').value,
        clave: document.getElementById('clave').value,
      }),
    });
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.error);
    guardarSesion(datos.token, datos.nombre);
    document.getElementById('clave').value = '';
    mostrarPanel();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('d-none');
  }
});

document.getElementById('salir').addEventListener('click', async () => {
  try { await api('/api/logout', { method: 'POST' }); } catch {}
  mostrarLogin();
});

// ---------- acciones sobre una solicitud ----------
async function accion(codigo, nombreAccion) {
  aviso.classList.add('d-none');
  try {
    await api('/api/solicitudes/' + encodeURIComponent(codigo), {
      method: 'PATCH',
      body: JSON.stringify({ accion: nombreAccion }),
    });
  } catch (err) {
    if (err.message !== 'Sesión vencida') {
      aviso.textContent = err.message;
      aviso.classList.remove('d-none');
    }
  }
  refrescar();
}

function boton(texto, clase, codigo, nombreAccion) {
  const b = document.createElement('button');
  b.className = `btn btn-sm ${clase}`;
  b.textContent = texto;
  b.addEventListener('click', (e) => { e.stopPropagation(); accion(codigo, nombreAccion); });
  return b;
}

// ---------- dibujo del panel ----------
function crearTarjeta(s) {
  const card = document.createElement('div');
  card.className = `card fila-${s.urgencia}` + (s.estado === 'resuelta' ? ' opacity-50' : '');

  const body = document.createElement('div');
  body.className = 'card-body py-2';

  const cabecera = document.createElement('div');
  cabecera.className = 'd-flex justify-content-between align-items-start gap-2';
  const titulo = document.createElement('strong');
  titulo.textContent = `${s.codigo} · ${ETIQUETA_TIPO[s.tipo] || s.tipo}`;
  const badges = document.createElement('div');
  badges.className = 'text-end';
  const bu = document.createElement('span');
  bu.className = `badge badge-${s.urgencia} me-1`;
  bu.textContent = s.urgencia.toUpperCase();
  const be = document.createElement('span');
  be.className = `badge ${COLOR_ESTADO[s.estado]}`;
  be.textContent = ETIQUETA_ESTADO[s.estado];
  badges.append(bu, be);
  cabecera.append(titulo, badges);

  const sector = document.createElement('div');
  sector.className = 'small';
  sector.textContent = s.sector;
  body.append(cabecera, sector);

  if (s.detalle) {
    const d = document.createElement('div');
    d.className = 'small text-muted';
    d.textContent = s.detalle;
    body.append(d);
  }
  if (s.asignado_a) {
    const a = document.createElement('div');
    a.className = 'small fw-semibold';
    a.textContent = 'Atiende: ' + s.asignado_a;
    body.append(a);
  }

  const hora = document.createElement('div');
  hora.className = 'small text-muted mb-2';
  hora.textContent = s.creada_en;
  body.append(hora);

  // Detalle completo (se despliega al tocar la tarjeta)
  const detalle = document.createElement('div');
  detalle.className = 'small border-top pt-2 mb-2' + (abiertas.has(s.codigo) ? '' : ' d-none');
  const filas = [
    ['Necesidad', ETIQUETA_TIPO[s.tipo] || s.tipo],
    ['Sector', s.sector],
    ['Descripción', s.detalle || 'Sin descripción'],
    ['Urgencia', s.urgencia.toUpperCase()],
    ['Estado', ETIQUETA_ESTADO[s.estado]],
    ['Responsable', s.asignado_a || 'Sin asignar'],
    ['Registrada', s.creada_en],
  ];
  filas.forEach(([k, v]) => {
    const p = document.createElement('div');
    const b = document.createElement('strong');
    b.textContent = k + ': ';
    p.append(b, document.createTextNode(v));
    detalle.append(p);
  });
  body.append(detalle);
  card.style.cursor = 'pointer';
  card.addEventListener('click', () => {
    detalle.classList.toggle('d-none');
    if (detalle.classList.contains('d-none')) abiertas.delete(s.codigo); else abiertas.add(s.codigo);
  });

  const acciones = document.createElement('div');
  acciones.className = 'd-flex gap-2';
  if (s.estado === 'pendiente') {
    acciones.append(boton('Tomar', 'btn-primary', s.codigo, 'tomar'));
  } else if (s.estado === 'en_atencion') {
    acciones.append(boton('Marcar resuelta', 'btn-success', s.codigo, 'resolver'));
    acciones.append(boton('Devolver a pendiente', 'btn-outline-secondary', s.codigo, 'reabrir'));
  } else {
    acciones.append(boton('Reabrir', 'btn-outline-secondary', s.codigo, 'reabrir'));
  }
  body.append(acciones);

  card.append(body);
  return card;
}

// ---------- filtros ----------
const fUrgencia = document.getElementById('f-urgencia');
const fEstado = document.getElementById('f-estado');

function dibujarLista() {
  const filtradas = ultimas.filter((s) =>
    (!fUrgencia.value || s.urgencia === fUrgencia.value) &&
    (!fEstado.value || s.estado === fEstado.value));
  lista.replaceChildren(...filtradas.map(crearTarjeta));
  vacio.classList.toggle('d-none', filtradas.length > 0);
}
fUrgencia.addEventListener('change', dibujarLista);
fEstado.addEventListener('change', dibujarLista);

// ---------- alerta de casos nuevos ----------
const btnAlerta = document.getElementById('btn-alerta');
btnAlerta.addEventListener('click', () => {
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
  btnAlerta.textContent = '🔔 Alertas activas';
  btnAlerta.classList.replace('btn-outline-dark', 'btn-dark');
  pitar();
});

function pitar() {
  if (!audio) return;
  [0, 0.35, 0.7].forEach((t) => {
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.frequency.value = 880;
    vol.gain.value = 0.25;
    osc.connect(vol).connect(audio.destination);
    osc.start(audio.currentTime + t);
    osc.stop(audio.currentTime + t + 0.2);
  });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function revisarNuevas(solicitudes) {
  const codigos = new Set(solicitudes.map((s) => s.codigo));
  if (vistos) {
    const nuevas = solicitudes.filter((s) => !vistos.has(s.codigo));
    const altas = nuevas.filter((s) => s.urgencia === 'alta');
    const caja = document.getElementById('alerta-nueva');
    if (altas.length) {
      caja.textContent = 'URGENTE: ' + altas.map((s) =>
        `${s.codigo} (${ETIQUETA_TIPO[s.tipo] || s.tipo}, ${s.sector})`).join(' · ');
      caja.classList.remove('d-none');
      pitar();
    } else if (!solicitudes.some((s) => s.urgencia === 'alta' && s.estado === 'pendiente')) {
      caja.classList.add('d-none');
    }
  }
  vistos = codigos;
}

async function refrescar() {
  try {
    const [solicitudes, resumen] = await Promise.all([api('/api/solicitudes'), api('/api/resumen')]);
    document.getElementById('c-pendientes').textContent = resumen.pendientes;
    document.getElementById('c-atencion').textContent = resumen.en_atencion;
    document.getElementById('c-resueltas').textContent = resumen.resueltas;
    revisarNuevas(solicitudes);
    ultimas = solicitudes;
    dibujarLista();
  } catch (err) {
    if (err.message !== 'Sesión vencida') console.error('No se pudo actualizar el panel', err);
  }
}

// Al abrir la página: si ya hay sesión guardada, entrar directo
if (token()) mostrarPanel(); else mostrarLogin();
