# Limitaciones conocidas y estado de la aceptación

## Estado frente a los criterios de aceptación

| Criterio | Estado | Evidencia / nota |
| -------- | ------ | ---------------- |
| Dos jugadores en dispositivos diferentes | ⚠️ Verificado solo con **navegadores automatizados independientes** (Chromium, contextos aislados). **Sin prueba en teléfonos físicos.** | `e2e/tour.spec.ts`, `docs/TESTING.md` |
| Crear y compartir una sala | ✅ | Código + enlace `#/sala/…`, botón "Invitar" (Web Share / copiar) |
| Seleccionar personajes | ✅ | Chispa/Bruma exclusivos, 4 apariencias, accesorios |
| Partida sincronizada | ✅ | Cuenta regresiva y reloj del servidor |
| Carrera del Caos jugable | ✅ | Tests de sim, sala, red y E2E |
| Sincronizados jugable | ✅ | Ídem |
| ¿Cuánto me conocés? jugable | ✅ | Ídem |
| Puntuaciones consistentes | ✅ | Resultados idénticos en ambos clientes (red y E2E); el servidor es la única autoridad |
| Finalizar una partida | ✅ | |
| Revancha | ✅ | Sin crear sala nueva (red y E2E) |
| Reconexión según condiciones documentadas | ✅ | Pausa hasta 90 s, reanudación con token (red y E2E). Ver condiciones abajo |
| Gráficos y sonidos coherentes | ✅ (revisión visual en Chromium; audio medido en Chromium) | Sin escucha en teléfono real |
| Sin errores críticos conocidos | ✅ | Ninguno abierto al cierre de esta entrega |
| Build de producción | ✅ | `npm run build` |
| Pruebas automatizadas relevantes | ✅ | 145 Vitest + 8 E2E |
| Versión desplegada verificada | ❌ **No desplegada** | El entorno no tiene acceso de red a proveedores de hosting ni credenciales. Listo para Render en ~5 min (ver `docs/DEPLOYMENT.md`) |

## Condiciones de reconexión

- Si un jugador pierde la conexión **durante una partida**, la partida se pausa para
  ambos hasta **90 s**. Al volver (el cliente reintenta solo; si se cerró la pestaña,
  "Volver a mi sala" en el inicio del mismo dispositivo) hay cuenta regresiva de 3 s.
- Pasados 90 s sin volver: termina por abandono.
- En el **lobby/resultados** el lugar se reserva **10 min**.
- La reanudación usa el token guardado en `sessionStorage` (misma pestaña) o en
  `localStorage` (mismo dispositivo/navegador). En otro dispositivo no se puede recuperar
  el lugar (no hay cuentas): hay que volver a invitar con el código.
- Si el **servidor se reinicia** (deploy, plan gratuito que se duerme con la sala vacía),
  las salas se pierden: se muestra un aviso y hay que crear una nueva.

## Limitaciones técnicas

1. **Sin pruebas en hardware real ni en Safari/WebKit.** Todo se probó en Chromium. El
   código contempla iOS (desbloqueo de audio tras gesto, `webkitAudioContext`, safe
   areas, `visualViewport`, sin vibración), pero no fue ejecutado en un iPhone.
2. **Salas en memoria, una sola instancia.** No escala horizontalmente ni sobrevive
   reinicios. Para más usuarios: adaptador Redis de Socket.IO + persistencia.
3. **Plan gratuito**: el servidor se duerme tras ~15 min sin tráfico; el primer acceso
   tarda ~30–60 s.
4. **Progreso local**: logros, accesorios e historial viven en el `localStorage` del
   dispositivo. Borrar datos del navegador los reinicia. El servidor no puede verificar
   desbloqueos (son solo cosméticos; valida que el accesorio exista).
5. **Anti-trampas**: el servidor valida todas las entradas, simula todo y decide
   resultados; aun así, un cliente modificado podría jugar con entradas "perfectas"
   (un bot). En un juego de pareja se considera aceptable.
6. **Enlace de invitación**: el código (≈39,6 bits) permite tomar un asiento **libre**;
   si el enlace se reenvía a otra persona antes de que entre la pareja, esa persona podría
   ocupar el lugar. Una vez completa, la sala no admite a nadie más.
7. **Audio**: niveles calibrados por medición, no escuchados en parlantes de teléfono.
   En iPhone, con el interruptor de silencio activado, iOS silencia Web Audio.
8. **Pantalla completa**: Safari en iPhone no permite pantalla completa desde la web;
   "Agregar a inicio" (PWA) abre sin barras del navegador.
9. **Accesibilidad**: menús, quiz y resultados son accesibles (botones etiquetados,
   lectores de pantalla, foco visible, reducir movimiento). La carrera y el templo son
   juegos de habilidad visual-motora y no son jugables con lector de pantalla.
10. **Idioma**: solo español rioplatense. Las 160 preguntas son originales y pasaron
    filtros automáticos de largo y temas sensibles, pero **conviene una lectura del
    equipo de producto** antes del lanzamiento.
11. **Tamaño de descarga**: Phaser pesa ~332 KB gzip; la interfaz aparece primero y el
    motor carga en paralelo.
12. **Docker**: el `Dockerfile` no pudo construirse aquí (sin daemon de Docker); su etapa
    de ejecución se reprodujo manualmente (instalación solo de producción + arranque OK).
