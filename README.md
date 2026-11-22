# DUO — Caos para Dos

**Jugar ahora: <https://duo-caos-para-dos.onrender.com>** (servidor gratuito: si llevaba un rato
sin uso, la primera carga puede tardar hasta un minuto).

Videojuego web multijugador para **dos personas, cada una desde su celular**: aventura
cooperativa, competencia amistosa, humor y romance opcional. Sin registro, sin
anuncios, sin instalar nada.

**Mundo 1 · La Isla del Caos** — tres minijuegos completos:

| Juego | Tipo | En pocas palabras |
| ----- | ---- | ----------------- |
| **Carrera del Caos** | competitivo | Carrera con saltos, deslizadas, Cajas del Caos (turbo, cáscara, nube gruñona, beso volador, escudo) y eventos de caos. Pista distinta en cada revancha. |
| **Sincronizados** | cooperativo | Templo de 4 salas: placas, barreras de color por personaje, puente, ascensor para dos y consolas que hay que presionar a la vez. |
| **¿Cuánto me conocés?** | romántico/humor | Adiviná lo que respondería tu pareja; revelación simultánea; pasar no resta. 160 preguntas originales. |

Más la **Gira por la Isla** (los tres seguidos con Copa final), revancha sin crear sala
nueva, reacciones, logros y accesorios desbloqueables.

Protagonistas originales: **Chispa** (llamita impulsiva) y **Bruma** (nube bromista), con
arte vectorial generado por código, animación por partes y música/efectos sintetizados
en tiempo real (todo original).

## Cómo se juega

1. Una persona abre la web y toca **Crear partida**.
2. Toca **Invitar** y manda el enlace (o dicta el código de 8 caracteres).
3. La otra persona abre el enlace en su celular.
4. Cada quien elige personaje, apariencia y accesorio; eligen el juego; ambos **¡Estoy listo!**

## Desarrollo local

Requisitos: Node 20.19+ (probado con 22) y npm.

```bash
npm ci
npm run dev          # servidor en :3000 (tsx watch) + cliente Vite en :5173
```

Abrir <http://localhost:5173> en dos ventanas de incógnito (o dos navegadores) para
jugar de a dos. Desde un celular en la misma red: `http://<IP-de-tu-compu>:5173`.

```bash
npm run check        # tipos + lint + tests + build
npm run build        # build de producción
npm start            # sirve todo en :3000 (NODE_ENV=production recomendado)
npm run build:e2e && npm run e2e   # E2E con dos navegadores (Playwright/Chromium)
```

## Stack

TypeScript estricto · Phaser 3.90 · React 19 · Vite 7 · Node 22 · Socket.IO 4.8 ·
zod · Vitest 4 · Playwright · GitHub Actions. Monorepo con npm workspaces:

```
apps/web         cliente (React para menús/HUD, Phaser para el juego, audio WebAudio)
apps/server      servidor autoritativo (salas, juegos, seguridad, estáticos)
packages/shared  tipos, protocolo, esquemas, simulaciones deterministas, quiz
e2e              pruebas de extremo a extremo con dos navegadores
docs             documentación
```

## Documentación

- [Arquitectura y netcode](docs/ARCHITECTURE.md) — por qué Socket.IO, modelo autoritativo, predicción, seguridad
- [Diseño de juego](docs/GAME_DESIGN.md) — reglas, controles y puntajes
- [Despliegue](docs/DEPLOYMENT.md) — Render gratis (Blueprint), Docker, variables
- [Pruebas](docs/TESTING.md) — qué se probó, resultados y checklist físico
- [Limitaciones](docs/LIMITATIONS.md) — estado de la aceptación y condiciones de reconexión
- [Plan de expansión](docs/CONTENT_ROADMAP.md) — próximos minijuegos y mundos
- Brief original: [PRODUCT_BRIEF](docs/PRODUCT_BRIEF.md) · [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md)

## Privacidad

Sin cuentas, sin métricas de seguimiento, sin publicidad. Las salas viven en memoria
del servidor y se borran al cerrarse; los logros quedan solo en tu dispositivo. Los
registros del servidor no incluyen IPs, nombres, códigos ni respuestas.

## Licencia y recursos

Código y recursos (arte, música, efectos, preguntas) creados para este proyecto.
Tipografías Fredoka y Nunito (SIL Open Font License) vía `@fontsource`.
Dependencias con licencias MIT/BSD/ISC/Apache.
