# Despliegue — DUO

## Qué hace falta

DUO es **un único servicio Node.js** que sirve el cliente (archivos estáticos) y el
servidor de tiempo real (Socket.IO/WebSocket) en el mismo origen. Por eso:

- **No alcanza con hosting estático** (GitHub Pages, Netlify estático, etc.): hace
  falta un proceso Node con conexiones persistentes.
- HTTPS/WSS lo provee el hosting (terminación TLS en su proxy). El cliente se conecta
  al mismo origen (`wss://tu-app/socket.io/`), sin configuración extra.
- No hay base de datos ni secretos: las salas viven en memoria.

## Opción recomendada: Render (plan gratuito, USD 0)

El repositorio incluye `render.yaml` (Blueprint).

1. Entrar a <https://dashboard.render.com> con la cuenta de GitHub del dueño del repo.
2. **New → Blueprint** y elegir el repositorio `duo-caos-para-dos` (rama `main` o la de desarrollo).
3. Render lee `render.yaml`: servicio web `duo-caos-para-dos`, plan **Free**,
   build `npm ci --include=dev && npm run build`, start `node apps/server/dist/index.js`,
   health check `/healthz`.
4. Al terminar, Render da una URL `https://duo-caos-para-dos-XXXX.onrender.com`.
5. Verificar: abrir `https://…/healthz` (debe responder `{"ok":true,…}`), crear una sala
   en un celular y unirse desde otro celular **con otra conexión** (por ejemplo, uno con
   Wi‑Fi y otro con datos móviles).

**Límites del plan gratuito de Render** (a la fecha de escritura; revisar en su sitio):

- El servicio **se duerme tras ~15 min sin tráfico**; el primer acceso tarda ~30–60 s
  en despertar (la pantalla de inicio muestra "Conectando con el servidor…").
- 750 horas de instancia por mes (alcanza para un servicio encendido todo el mes).
- Un redeploy o reinicio **cierra las salas en curso** (están en memoria).
- Sin costo mientras se use el plan Free; no requiere tarjeta para este plan.

## Alternativas

### Docker (cualquier proveedor con contenedores: Koyeb, Fly.io, Railway, VPS)

```bash
docker build -t duo .
docker run -p 3000:3000 duo
# → http://localhost:3000
```

La imagen es multi-etapa (Node 22 Alpine), corre como usuario `node`, expone el
puerto 3000 y tiene `HEALTHCHECK` sobre `/healthz`. En proveedores detrás de proxy,
`TRUST_PROXY=1` ya viene seteado en la imagen.

> Fly.io y Railway pueden exigir tarjeta o tener créditos de prueba limitados: no
> se contrató nada pago. Consultar sus condiciones antes de usarlos.

### Manual (VPS propio)

```bash
npm ci --include=dev
npm run build
NODE_ENV=production TRUST_PROXY=1 PORT=3000 node apps/server/dist/index.js
```

Delante, un proxy con TLS (Caddy/Nginx) que reenvíe WebSocket (`Upgrade`/`Connection`).

## Variables de entorno (todas opcionales)

| Variable                   | Por defecto                | Uso                                                        |
| -------------------------- | -------------------------- | ---------------------------------------------------------- |
| `PORT`                     | `3000`                     | Puerto HTTP                                                |
| `HOST`                     | `0.0.0.0`                  | Interfaz                                                   |
| `NODE_ENV`                 | —                          | `production` desactiva orígenes de desarrollo              |
| `TRUST_PROXY`              | `0`                        | `1` detrás del proxy del hosting (IP real, HSTS)           |
| `STATIC_DIR`               | `apps/web/dist`            | Carpeta del build del cliente (`''` = no servir estáticos) |
| `ALLOWED_ORIGINS`          | —                          | Orígenes extra para Socket.IO si el cliente está en otro dominio |
| `MAX_ROOMS`                | `500`                      | Tope de salas simultáneas                                  |
| `MAX_CONNECTIONS_PER_IP`   | `16`                       | Conexiones simultáneas por IP                              |
| `JOIN_ATTEMPTS_PER_MINUTE` | `20`                       | Intentos de crear/unirse/reanudar por IP y minuto          |

Si el cliente se publicara en otro dominio (p. ej. estático en otro hosting), compilarlo
con `VITE_SERVER_URL=https://servidor` y agregar ese origen en `ALLOWED_ORIGINS`.

## Despliegue actual

- **URL pública:** <https://duo-caos-para-dos.onrender.com>
- **Hosting:** Render, servicio web **plan Free** (USD 0), región Virginia (EE. UU. este),
  Node 22, `autoDeploy` activado sobre la rama de desarrollo.
- Se creó por la API de Render con los mismos parámetros de `render.yaml`
  (build `npm ci --include=dev && npm run build`, start `node apps/server/dist/index.js`,
  health check `/healthz`, variables `NODE_VERSION=22`, `NODE_ENV=production`, `TRUST_PROXY=1`).
- **Cada push a esa rama redespliega** y, al reiniciar, cierra las salas abiertas.
  Para producción estable conviene apuntar el servicio a `main` una vez mergeado el PR
  (Render → Settings → Branch).

### Verificar un despliegue

```bash
curl https://TU-APP/healthz            # {"ok":true,...}
npm run smoke -- https://TU-APP        # juega la Gira completa + revancha por WSS
```

`npm run smoke` crea una sala, une a un segundo cliente, juega **carrera, templo y quiz**
con dos clientes automáticos (mismo código de predicción que el navegador) y pide la
revancha. Sale con código 0 solo si todo funcionó. Sirve para cada deploy futuro.
