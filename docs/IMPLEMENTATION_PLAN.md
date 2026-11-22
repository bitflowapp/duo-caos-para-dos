# Plan de ejecución autónoma — DUO

Las etapas son incrementos **jugables** con criterio de salida objetivo, no entregables de documentación.

## 0. Base e infraestructura
- Identificar limitaciones de entorno remoto y hosting gratuito, especialmente WebSockets persistentes y suspensión de instancias.
- Definir arquitectura y esquema de mensajes. Crear frontend, backend y paquete compartido.
- Configurar `npm` / lockfile, TypeScript strict, lint, Vitest, Playwright y CI.
**Salida:** ambos servicios corren y compilación/tests básicos pasan.

## 1. Sala privada multijugador
- Crear/unir sala, código/enlace, máximo dos participantes, ready, cierre, expiración, desconexión y reconexión.
- Validar mensajes, pertenencia a sala, aislamiento, intentos de ingreso no autorizado.
**Salida:** dos clientes en navegadores independientes observan estados idénticos sin simulación.

## 2. Carrera del Caos
- Crear un nivel propio con controles móviles, físicas/colisiones, obstáculos, línea de llegada y resultado autoritativo.
- Música/sonidos, feedback táctil, tutorial, reinicio y revancha.
**Salida:** dos jugadores completan una carrera con ganador correcto y sin desincronización crítica.

## 3. Sincronizados
- Construir nivel cooperativo con decisiones interdependientes.
- Sincronizar mecanismos, tiempo, progreso, meta compartida, errores y reinicio.
**Salida:** puzzle resoluble y comprobado en dos clientes.

## 4. ¿Cuánto me conocés?
- Banco original de preguntas y opciones; respuestas privadas hasta revelación; puntaje y omisión voluntaria.
- UI táctil, feedback humorístico y puntuación consistente.
**Salida:** ronda completa reproducible sin fugas de respuestas antes del momento previsto.

## 5. Arte, accesibilidad y pulido
- Personajes coherentes, animaciones, partículas, música original o correctamente licenciada, mute, carga rápida.
- Safe areas, orientación, reducir movimiento cuando sea viable, contraste, hit targets táctiles.
**Salida:** experiencia sólida en viewport móvil y prueba manual documentada.

## 6. Seguridad, calidad y despliegue
- Tests unitarios, integración, E2E de dos clientes, reconexión, manipulación de eventos, rate limit, aislamiento.
- Build de producción, auditoría básica y CI. Deploy únicamente a infraestructura autorizada con coste confirmado USD 0.
- Documentar URL verificada, hosting usado, límites de free tier, pruebas efectuadas, problemas pendientes y pasos físicos restantes.
**Salida:** cumplen los criterios de aceptación de `CLAUDE.md`.

## Cadencia y comunicación
Trabajar de forma autónoma, registrar commits por mejoras cerradas y preparar PR de desarrollo. Consultar sólo bloqueos de permisos, MFA o costes; agruparlos en un único pedido. No declarar éxito por crear una pantalla o escribir un plan.