# RedSOS

Sistema local de comunicación y gestión de emergencias. Corre en una **laptop** que crea su
propia red Wi-Fi (hotspot): las personas piden ayuda desde el celular sin Internet y los
brigadistas ven las solicitudes por prioridad.

## Inicio rápido (Windows)

1. Enciende la **Zona con cobertura inalámbrica** de Windows con el nombre `RedSOS`
   (Configuración → Red e Internet → Zona con cobertura inalámbrica móvil).
   Anota la contraseña y ponla en `iniciar.bat` (`REDSOS_WIFI_CLAVE`).
2. Doble clic en `iniciar.bat`. Abre en la laptop la pantalla **Conectar** con dos QR:
   uno para entrar a la red Wi-Fi y otro para abrir RedSOS.
3. Permite el puerto 3000 en el Firewall de Windows (redes privadas **y públicas**) si
   los celulares no cargan la página.

## Qué incluye el Sprint 1

- US-01 Página de inicio accesible sin Internet (Bootstrap servido localmente, sin CDN).
- US-02/03/04 Formulario: necesidad, sector y urgencia.
- US-05 Confirmación con código (`RS-0001`) y estado "pendiente".
- US-06 Panel del brigadista con urgentes arriba, contadores y actualización cada 5 s.
- Extra: consulta de estado por código y badge "Modo sin Internet / Con Internet".

## Qué incluye el Sprint 2

- US-09 Login del brigadista (usuario y contraseña; la lista de solicitudes ya no es pública).
- US-08 Botón **Tomar**: la solicitud pasa a "En atención" con el nombre del brigadista.
  Si otro ya la tomó, el sistema avisa y no la pisa.
- US-07 Botones **Marcar resuelta**, **Devolver a pendiente** y **Reabrir**.
- Las resueltas bajan al final de la lista.

## Novedades de esta versión (Sprint 2 con laptop)

- Inicio con un clic: `iniciar.bat` + pantalla `/conectar.html` con QR de la red y de la página.
- Filtros por urgencia y estado en el panel.
- Detalle del caso: se despliega al tocar la tarjeta.
- Actualización cada 3 s y alerta (pitido + vibración + banner rojo) cuando entra un caso de
  urgencia **alta**. El navegador exige un toque previo: el brigadista debe pulsar **Activar alertas**.

Siguiente (Sprint 3): ficha de caso para el campo, reclasificar urgencia, anti-spam, historial y
sincronización a Firebase. Cada cambio de estado ya deja la solicitud con `sincronizado = 0`.

## Brigadistas

Al primer arranque se crea un usuario de demo: `brigadista` / `redsos123`. Para crear los
reales (o cambiar una clave):

    npm run brigadista -- jperez "Juan Pérez" miClave123

Las sesiones viven en memoria: si se reinicia el servidor, hay que volver a entrar.

## Cómo correrlo a mano

Requiere Node.js 22.13 o superior (usa el SQLite integrado de Node: no hay que compilar nada).
Puede salir un aviso "SQLite is an experimental feature"; es normal.

    npm install       # solo la primera vez, con Internet
    npm run seed      # opcional: 6 solicitudes de ejemplo
    npm start

Variables opcionales: `PORT`, `REDSOS_WIFI` (nombre de la red) y `REDSOS_WIFI_CLAVE`.
Páginas: `/` inicio · `/ayuda.html` formulario · `/consulta.html` estado ·
`/brigadista.html` panel (con login) · `/conectar.html` QR para conectarse.

Si el hotspot de Windows no enciende sin Internet, usa un router portátil o el hotspot de un
celular Android: el sistema funciona igual mientras la laptop esté en esa red.

## API

- `POST /api/solicitudes` crea una solicitud (`tipo`, `sector`, `urgencia`, `detalle`).
- `POST /api/login` y `POST /api/logout` (sesión del brigadista, token `Bearer`).
- `GET /api/solicitudes` lista ordenada por urgencia (requiere sesión).
- `PATCH /api/solicitudes/:codigo` con `{"accion": "tomar" | "resolver" | "reabrir"}` (requiere sesión).
- `GET /api/solicitudes/:codigo` consulta por código.
- `GET /api/resumen` contadores por estado (requiere sesión).
- `GET /api/estado` indica si hay Internet.
- `GET /api/info` red Wi-Fi y direcciones de la laptop · `GET /api/qr.svg?t=texto` QR en SVG.

Tipos: `agua`, `alimentos`, `medicamentos`, `persona_herida`, `otro`.
Urgencias: `alta`, `media`, `baja`. Estados: `pendiente`, `en_atencion`, `resuelta`.
