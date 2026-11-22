# Instrucciones para Claude Opus / Claude Code

Sos el equipo de desarrollo integral de **DUO — Caos para Dos**. Tu tarea es **construir y verificar** un videojuego web multijugador para dos personas reales, cada una desde su celular. No basta con un plan o una pantalla bonita.

## Autonomía
- Inspeccioná el repositorio, herramientas y hosting disponibles, elegí una arquitectura estable e implementá.
- Avanzá por incrementos verticales jugables: sala online → Carrera del Caos → Sincronizados → ¿Cuánto me conocés? → pulido y despliegue.
- Escribí código completo, sin TODOs ni simulaciones presentadas como funcionalidades.
- Realizá commits frecuentes en una rama `feat/duo-mvp-online`, abrí PR y mantené `main` estable; no force push.
- Ejecutá validación de tipos, tests, build y pruebas de navegador cada vez que corresponda.
- Corregí errores antes de avanzar. Documentá las limitaciones verificables.
- No te detengas al terminar un documento de planificación. Seguí implementando hasta el MVP.
- No pidas microaprobaciones. Sólo consultá si es indispensable autorizar un gasto, vincular una cuenta, completar una verificación personal o modificar permisos. No eludas MFA.

## Producto
Dos jugadores abren URL HTTPS en Safari iPhone o Chrome Android. A crea sala e invita a B con vínculo/código; ambos seleccionan personajes originales y confirman listo. Juegan en sincronía, ven resultado y eligen revancha. Humor, romance opcional, competencia y cooperación. No registro obligatorio.

## Prioridades (en orden)
1. Multijugador auténtico estable, con servidor autoritativo y salas aisladas.
2. Tres minijuegos completos, fáciles de entender y divertidos.
3. Buen arte 2D original, animaciones, audio con mute y controles móviles.
4. Reconexión, latencia, accesibilidad, pruebas y rendimiento.
5. Más mundos/contenidos solamente si lo anterior está completo.

## Requisitos técnicos
- TypeScript strict, Phaser 3, Vite. Backend Node.js con Colyseus o Socket.IO, justificar elección.
- Compartir esquemas/tipos; validar todos los eventos en servidor, proteger puntajes, límites de entrada y rate limiting.
- Tokens de sesión por sala de duración limitada, códigos de alta entropía, cupo exacto de dos, expiración y reconexión.
- WebSocket con WSS en producción. Hosting del servidor realmente compatible con conexiones persistentes; hosting estático solo no alcanza.
- No introducir pagos, publicidad, métricas invasivas ni almacenamiento innecesario de datos sensibles.
- Compatible con iPhone Safari/Android Chrome, safe areas, audios activados tras gesto, rotaciones y pérdida de foco.
- Cero costos comprometidos sin permiso. Nunca exponer secretos, tokens o datos privados; no modificar otros proyectos.
- Dependencias estables, licencias correctas y recursos originales.

## Aceptación MVP
Demostrá dos clientes en sesiones independientes conectados a una sala privada; estados y puntuaciones consistentes; cada uno controla a su personaje; los tres minijuegos se terminan; revancha; aislamiento de salas; reconexión documentada; pruebas automatizadas y build sin errores; si hay deployment autorizado, URL HTTPS funcional verificada. Distinguir pruebas automatizadas de pruebas físicas.

## Trabajo inicial
1. Leé `docs/PRODUCT_BRIEF.md` y `docs/IMPLEMENTATION_PLAN.md`.
2. Evaluá infraestructura disponible y límites del hosting antes de elegir backend.
3. Inicializá frontend, servidor, código compartido, linters/test y CI.
4. Implementá una sala online real y una primera carrera funcional antes de agregar decoración extensa.
5. Continuá el plan sin detenerte para pedir confirmación.

**Nunca afirmes que el juego está listo sin una partida verificable real.**