# Arquitectura técnica — DUO

## Resumen

```
 Celular A (navegador)                         Celular B (navegador)
 ┌───────────────────────────┐                 ┌───────────────────────────┐
 │ React (menús, HUD, quiz)  │                 │ React (menús, HUD, quiz)  │
 │ Phaser 3 (escenas, arte)  │                 │ Phaser 3 (escenas, arte)  │
 │ Predicción local (sim     │                 │ Predicción local (sim     │
 │ compartida) + audio WebAudio                │ compartida) + audio WebAudio
 └────────────┬──────────────┘                 └──────────────┬────────────┘
              │ WSS (Socket.IO) · solo entradas, nunca puntajes  │
              └───────────────┐                 ┌───────────────┘
                        ┌─────▼─────────────────▼─────┐
                        │ Servidor Node.js (único)    │
                        │ · sirve el build estático   │
                        │ · Socket.IO + validación zod│
                        │ · RoomManager (memoria)     │
                        │ · simulación AUTORITATIVA   │
                        └─────────────────────────────┘
```

Un único servicio Node.js sirve el cliente (HTML/JS precomprimidos) y el WebSocket
por el **mismo origen**, de modo que en producción todo viaja por HTTPS/WSS con el
certificado del hosting y no hacen falta reglas CORS.

## Monorepo

| Paquete           | Contenido                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `packages/shared` | Tipos, protocolo, esquemas zod, simulaciones deterministas (carrera, cooperativo), lógica y banco del quiz, bots de prueba |
| `apps/server`     | Node + Socket.IO: salas, juegos autoritativos, seguridad, servidor HTTP estático              |
| `apps/web`        | Vite + React (interfaz) + Phaser 3 (juego) + motor de audio WebAudio                          |
| `e2e`             | Playwright: dos navegadores independientes contra el servidor real                            |

Separación pedida en el brief:

- **Motor de juego**: `packages/shared/src/race|coop` (simulación) y `apps/web/src/game` (render/escenas).
- **Interfaz**: `apps/web/src/ui` (React).
- **Networking**: `apps/web/src/net` (cliente), `apps/server/src/sockets.ts`, `RoomManager.ts`, `Room.ts`.
- **Lógica compartida**: `packages/shared`.
- **Persistencia**: `apps/web/src/persistence` (localStorage del dispositivo; el servidor no persiste nada).
- **Recursos artísticos**: `apps/web/src/game/art` (SVG generado por código) y `apps/web/src/audio` (síntesis).
- **Pruebas**: `packages/shared/test`, `apps/server/test`, `apps/web/test`, `e2e`.

## Por qué Socket.IO (y no Colyseus)

Se evaluaron ambos. Se eligió **Socket.IO 4.8** porque:

1. **Control total de la seguridad que pide el brief**: códigos propios de alta entropía,
   tokens de sesión de 256 bits (solo se guarda su hash), cupo exacto de dos,
   expiraciones y reconexión con token. Colyseus trae su propio modelo de salas y
   `reconnectionToken`, que habría que adaptar o envolver igual.
2. **El estado es chico** (2 jugadores): no aprovechamos la sincronización delta de
   esquemas de Colyseus; enviamos snapshots compactos a 20 Hz.
3. **Netcode a medida**: el modelo "usercmd" (entradas por tick con predicción y
   reconciliación sobre una simulación determinista compartida) se implementa
   directamente sobre eventos; con Colyseus habría que esquivar su sincronización.
4. **Robustez en redes móviles**: Socket.IO cae a *long-polling* si un proxy de la
   operadora bloquea WebSocket, y es muy estable/maduro.
5. **Menos dependencias y decoradores**: TypeScript estricto puro, tipos de eventos
   compartidos (`ClientToServerEvents`/`ServerToClientEvents`).

## Modelo autoritativo y netcode

### Simulación determinista compartida

`packages/shared/src/race/sim.ts` y `coop/sim.ts` son funciones puras de paso fijo
(60 ticks/s) que solo usan aritmética básica IEEE‑754 → el mismo resultado en V8
(servidor, Chrome) y JavaScriptCore (Safari). El cliente y el servidor ejecutan **el
mismo código**.

### Flujo de una partida en tiempo real (carrera y cooperativo)

1. El servidor fija un reloj de partida (`ClockPayload`: en qué hora del servidor
   empieza el tick 0). El cliente estima la hora del servidor con pings tipo NTP
   (muestras de menor RTT) y calcula el tick actual.
2. **El cliente nunca envía posiciones ni puntajes**: envía *botones por tick*
   (`{ m: partida, t: primerTick, b: [bits…] }`) cada 2 ticks.
3. **El servidor simula a cada jugador con sus entradas** (`TickInputQueue`):
   un jugador con más latencia no pierde precisión en sus saltos. Límites:
   - no se aceptan ticks adelantados más de 30 al reloj del servidor (anti speed‑hack);
   - si un jugador se atrasa más de 45 ticks (pestaña en segundo plano, red caída), el
     servidor lo avanza con entrada neutra (no puede congelar la partida a propósito);
   - duplicados y ticks viejos se descartan.
4. El servidor emite snapshots a 20 Hz. El cliente compara su estado predicho para
   ese tick; si difiere (ítem del rival, mecanismo, corrección), **rebobina y
   re-simula** las entradas pendientes, con suavizado visual del error.
5. El rival/compañero se muestra interpolado entre snapshots (y extrapolado en X en
   la carrera para que ambos se vean "al mismo tiempo").
6. Ganador, tiempos, ítems, corazones, mecanismos y estrellas: **solo el servidor**.
   En la carrera el ganador se decide por *tick de llegada* de cada simulación, lo
   que es justo independientemente de la latencia.

### Quiz

Servidor con temporizadores: pregunta → 20 s → revelación simultánea. Las respuestas
de cada jugador **no salen del servidor** hasta que ambos respondieron o venció el
tiempo (`quiz:progress` solo dice *quién* respondió). La primera respuesta es la que
vale (anti-duplicados). "Pasar" reemplaza la pregunta (hasta 3 veces) sin restar.

## Salas, sesiones y reconexión

- **Código de sala**: 8 símbolos de un alfabeto de 31 (sin 0/O/1/I/L) generado con
  `crypto.randomInt` → ≈ 39,6 bits. Se combina con límite de 20 intentos/min por IP
  y de 6 por socket en ráfaga, salas que se llenan con 2 y expiran: el código **no es
  el mecanismo de seguridad**; solo permite tomar un asiento libre.
- **Token de sesión**: 256 bits aleatorios (base64url) por asiento; el servidor guarda
  solo `sha256(token)`. Vigencia: la de la sala (máx. 8 h). Para reconectar a un
  asiento ocupado hace falta el token; el socket queda ligado al asiento y toda acción
  usa el asiento del servidor (nunca un "slot" enviado por el cliente).
- **Pestaña duplicada**: si el mismo token reconecta desde otra pestaña, la vieja recibe
  `session:replaced`.
- **Desconexión en partida**: la partida se **pausa** (reloj congelado) hasta 90 s; al
  volver, cuenta regresiva de 3 s y sigue. Si no vuelve: abandono (gana el otro / el
  templo queda sin completar).
- **Expiración**: sala sin nadie conectado 3 min, inactiva 30 min en lobby/resultados,
  vida máxima 8 h; asiento desconectado en lobby se libera a los 10 min.
- **Persistencia**: todo en memoria. Un reinicio del servidor cierra las salas
  (los clientes muestran el aviso). Ver `docs/LIMITATIONS.md`.

## Seguridad

- Validación zod `.strict()` de **todos** los mensajes; rangos acotados; payload máx. 8 KB.
- Límites por socket (token bucket por categoría) y por IP (conexiones e intentos de
  sala). Abuso persistente → desconexión.
- CSP estricta (`default-src 'self'`, sin `unsafe-eval`), `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer` (el código va en el *fragmento* `#/sala/…`, que el
  navegador nunca envía al servidor), `nosniff`, HSTS detrás de HTTPS.
- Sin secretos en el navegador: no hay claves ni APIs de terceros.
- Logs sin datos personales (sin IPs, nombres, códigos ni respuestas).
- Nombres saneados (control/format chars, largo 14) y React escapa todo texto.

## Cliente

- **Arte original en SVG generado por código** (`game/art`), rasterizado al cargar a la
  densidad del dispositivo y empaquetado en atlas (menos cambios de textura).
- **Personajes "cutout"** (`CharacterRig`): partes separadas animadas por código
  (squash & stretch, parpadeo, ciclo de carrera, expresiones, abrazo).
- **Rendimiento**: lienzo a DPR ≤ 2 con zoom 1/DPR (nitidez), monitor de FPS que baja a
  DPR 1,5 / 1 si no llega a 45 fps, culling por columnas en la carrera, parallax con
  imágenes alternadas (en vez de TileSprites gigantes).
- **Móvil**: safe areas (`env(safe-area-inset-*)`), controles táctiles multitouch con
  captura de puntero, sin zoom por doble toque, *wake lock* durante la partida,
  pausa de audio al ocultar la pestaña, desbloqueo de audio tras el primer gesto.
- **Audio**: síntesis WebAudio (música y efectos originales), buses separados
  música/efectos y silencio global.

## Protocolo (resumen)

Cliente → servidor: `room:create|join|resume|leave`, `lobby:select|ready|mode`,
`game:input`, `quiz:answer|skip`, `coop:count`, `post:vote|lobby`, `emote`, `time:ping`.

Servidor → cliente: `room:state` (estado público completo del lobby/partida),
`room:closed`, `session:replaced`, `game:start|clock|snap|event`,
`quiz:question|progress|reveal`, `emote`, `error:msg`.

Tipos exactos en `packages/shared/src/protocol.ts`; versión de protocolo en el handshake.
