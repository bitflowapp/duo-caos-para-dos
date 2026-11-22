# Pruebas — DUO

> **Importante:** todas las pruebas de esta entrega son **automatizadas** y se ejecutaron
> en un contenedor Linux con Node 22 y **Chromium** (Playwright). **No se probaron
> dispositivos físicos** (iPhone/Android reales) ni el motor **WebKit/Safari**: el
> entorno no tenía WebKit instalado ni teléfonos conectados. Los perfiles "iPhone" de
> Playwright emulan pantalla, táctil y *user agent* sobre Chromium, no Safari.

## Cómo correrlas

```bash
npm ci
npm run typecheck   # TypeScript estricto en los tres paquetes
npm run lint        # ESLint
npm test            # Vitest: unitarias + integración (incluye 3 partidas completas por red, ~60 s)
npm run build       # build de producción (cliente + servidor)

# E2E (dos navegadores independientes contra el build de prueba)
npm run build:e2e
npm run e2e         # Playwright (Chromium): perfiles android-chromium e iphone-emulado-chromium
```

`npm run check` encadena typecheck + lint + test + build. CI (GitHub Actions) corre
lo mismo y luego los E2E en cada PR y en cada push a `main` (`.github/workflows/ci.yml`).
En GitHub, el job "Tipos, lint, tests y build" pasó en el primer push de esta rama
(incluidas las 3 partidas completas por red).

## Resultados de esta entrega (22/11/2026)

| Suite | Archivos | Pruebas | Resultado |
| ----- | -------- | ------- | --------- |
| TypeScript (`tsc` estricto, 3 paquetes) | — | — | ✅ sin errores |
| ESLint | — | — | ✅ sin errores |
| Vitest `shared` | 4 | 37 | ✅ |
| Vitest `server` (seguridad, salas, red) | 3 | 32 | ✅ |
| Vitest `server` partidas completas por red | 3 | 3 | ✅ (~60 s en paralelo) |
| Vitest `web` (audio) | 1 | 73 | ✅ |
| **Total Vitest** | **11** | **145** | ✅ |
| Playwright E2E (2 perfiles × 4 pruebas) | 2 | 8 | ✅ (6,8 min) |
| Build de producción | — | — | ✅ |

## Qué cubre cada suite

### Simulaciones compartidas (`packages/shared/test`)

- **Carrera**: pista determinista por semilla; orden variable de bloques; corazones
  ordenados; eventos de caos dentro del límite; *mismas entradas ⇒ mismo estado*
  (determinismo); un corredor sin entradas no llega; **el bot completa pistas de varias
  semillas sin caerse** (la pista es completable y dura ~1 min con juego perfecto);
  buffer de salto y doble salto; escudo vs. beso/nube; turbo; cáscara de mango.
- **Sincronizados**: **dos bots coordinados resuelven el templo** (con cada personaje en
  cada slot); placas y puertas; barrera de color por personaje; ascensor (sube con dos,
  se queda con uno); ventana de 0,8 s de las consolas; un mismo jugador no activa ambas;
  estrellas.
- **Quiz**: rondas de 8 sin repetir; evita preguntas ya usadas; personalización por
  quien mira; puntaje (acierto, coincidencia, omisión, sin respuesta); reemplazo liviano.
- **Banco de preguntas**: ids, campos por tipo, largos para pantallas chicas, `{name}`,
  términos vetados (celos, ex, dinero, etc.).
- **Varios**: normalización de códigos, saneamiento de nombres, reloj de partida.

### Servidor (`apps/server/test`)

- **Seguridad**: códigos con el alfabeto correcto y sin colisiones en 2000 muestras;
  tokens de 256 bits; solo se guarda el hash; *token bucket*; ventana por IP; cola de
  entradas (duplicados, anti *speed-hack*, huecos, tick final).
- **Sala con reloj simulado** (partidas completas en milisegundos): lobby (personajes
  distintos, listo, cambio de modo), **carrera completa**, **templo completo**,
  **quiz completo**, revelación solo tras ambas respuestas y sin fugas a la otra vista,
  pasar pregunta, **revancha**, **Gira por la Isla completa**, desconexión → pausa →
  reconexión con cuenta regresiva, abandono por tiempo, salir en plena partida,
  desconexión en la cuenta regresiva.
- **Integración por sockets reales**: dos clientes independientes ven el mismo estado;
  **cupo exacto de dos**; códigos inválidos/inexistentes; **aislamiento entre salas**;
  versión de protocolo; mensajes malformados y de no miembros ignorados; **reanudación
  con token** (y tokens falsos rechazados); **desconexión en plena carrera con pausa y
  reanudación**; abandonar libera el lugar; límite de intentos por IP.
- **Partidas completas por red** con el **mismo código de predicción del navegador**
  (`RacePredictor`/`CoopPredictor`) y bots como jugadores: carrera (ambos llegan,
  resultados idénticos en los dos clientes, ganador coherente con los tiempos,
  correcciones de predicción < 40, **revancha**), templo (éxito, 4/4 salas, puntos
  iguales) y quiz (8 revelaciones, **sin fugas** de respuestas, totales coherentes).

### Cliente (`apps/web/test`)

- **Audio**: datos de las composiciones (tempos, rango MIDI, compases), todas las
  recetas de efectos, planificador con contexto falso (sin notas duplicadas, nunca más
  de 0,12 s adelantadas, sin ráfagas tras bloqueos), motor completo (desbloqueo,
  crossfade, límite de voces, jingles, silencio, segundo plano).

### E2E (`e2e/`, Playwright, Chromium)

Cada prueba abre **dos contextos aislados** (sin almacenamiento compartido) contra el
servidor real con el build de prueba:

1. **Gira completa con revancha**: A crea la sala, B entra por el **enlace** de
   invitación, eligen personajes (Bruma queda bloqueada para A), eligen la Gira, ambos
   "listo" → **carrera** → resultados idénticos → "Siguiente juego" → **templo** →
   resultados idénticos ("Lo lograron") → **quiz** → **Copa de la Isla** → revancha
   (A vota, B ve el aviso, B vota, arranca otra carrera). Verifica **cero errores de
   consola**. Duración ~2,9 min por perfil.
2. **Sala llena**: un tercer navegador recibe "ya tiene a sus dos jugadores".
3. **Recarga en plena carrera**: B recarga la página → A ve "Partida en pausa" → B
   vuelve solo con el token de la pestaña → la carrera continúa.
4. **Pantalla de inicio en vertical** sin desbordes horizontales.

Las entradas de juego en E2E las genera un **piloto automático** que solo existe en
builds con `VITE_E2E=1` (se elimina del build de producción) y que pasa por el mismo
camino que los controles táctiles (`InputState` → predicción → servidor).

### Lighthouse (pantalla de inicio, perfil móvil simulado: 4G lenta y CPU ×4)

| Categoría | Puntaje |
| --------- | ------- |
| Accesibilidad | 100 |
| Buenas prácticas | 100 |
| Rendimiento | 48 |

El rendimiento de carga está limitado por el motor Phaser (~332 KB gzip) y por la
rasterización inicial de ~170 texturas SVG (Total Blocking Time ≈ 3,8 s con CPU ×4,
LCP 4,3 s). Mitigaciones aplicadas: la interfaz React aparece primero, Phaser se carga
en el primer momento ocioso y el rasterizado cede el hilo principal entre tandas. En
juego, la resolución baja sola si los FPS caen por debajo de 45.

### Verificación del despliegue (Render, 22/11/2026)

Contra <https://duo-caos-para-dos.onrender.com> (plan Free, región Virginia):

| Verificación | Resultado |
| ------------ | --------- |
| Build en Render (`npm ci --include=dev && npm run build`) | ✅ `live` en < 1 min |
| `GET /healthz` | ✅ 200 `{"ok":true,…}` |
| HTTPS | ✅ certificado válido, HTTP/2, `Strict-Transport-Security`, CSP de producción (`connect-src 'self' wss:`) |
| WebSocket | ✅ transporte `websocket` puro sobre `wss://…/socket.io/` (RTT ≈ 36 ms desde la sandbox) |
| Sala por red | ✅ crear, unirse, cupo lleno rechaza al tercero, `game:start` idéntico en ambos clientes |
| Navegador real (Chromium, Pixel 7) | ✅ interfaz lista en ~1,2 s, sala creada, canvas de Phaser activo, **0 errores de consola/CSP** |
| **Gira completa + revancha** (`npm run smoke`) | ✅ carrera, templo (3 ★), quiz (con puntos) y revancha sin crear sala |

`npm run smoke -- <URL>` queda en el repo para verificar cualquier despliegue futuro.
Sigue pendiente la prueba con **dos teléfonos físicos** (checklist más abajo).

### Verificación visual

Se revisaron capturas de Chromium (perfil Pixel 7, vertical y horizontal) de inicio,
lobby, cuenta regresiva, carrera, templo, quiz, resultados y Copa. Se corrigieron con
eso: bloques de suelo ocultos por el *culling*, texturas faltantes del templo,
costuras en baldosas, nombres superpuestos y avisos que tapaban la pista.

## Pendiente: pruebas físicas (checklist)

Para completar la aceptación hace falta una partida real en dos teléfonos con la URL
desplegada (ver `docs/DEPLOYMENT.md`). Checklist sugerido:

- [ ] iPhone (Safari) + Android (Chrome), **conexiones distintas** (Wi‑Fi y datos).
- [ ] Crear sala en uno, compartir el enlace por WhatsApp, abrirlo en el otro.
- [ ] Elegir personajes, apariencia y accesorio; elegir la Gira; ambos "listo".
- [ ] Carrera: controles táctiles cómodos (saltar con el pulgar derecho, deslizar con el
      izquierdo), ítems, sonido tras el primer toque, sin cortes de animación.
- [ ] Templo: ◀ ▶, saltar y Acción; botón "Contar 3, 2, 1"; consolas sincronizadas.
- [ ] Quiz: tocar opciones, "Pasar", revelación al mismo tiempo en ambos.
- [ ] Bloquear la pantalla 20 s o cambiar de app en plena partida → pausa → volver → sigue.
- [ ] Rotar el teléfono (vertical/horizontal) en cada juego; muesca/safe areas.
- [ ] Silenciar/activar sonido; botón de silencio; volumen de música y efectos.
- [ ] Revancha y "Elegir otro juego" sin crear sala nueva.
- [ ] Medir fluidez (debería mantenerse cerca de 60 fps; si no, baja la resolución sola).
