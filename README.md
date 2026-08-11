# 🚗 Flota Control

App de gestión de flota con **acceso libre** (sin login), panel web y **bot de Telegram**. Tus unidades, tus datos, tu base de datos — sin depender de sistemas ajenos.

## Funcionalidades

- **Acceso libre**: cualquiera puede ver y editar la flota, sin cuentas ni contraseñas.
- **Flota de hoy**: el panel y el bot muestran **solo las 29 unidades** del inventario diario (Control Inventario de Flota Aeropuerto), con kilometraje, próximo servicio (km), estado (limpio/sucio), próximo mantenimiento, SOAT, revisión técnica y observaciones.
- **Flota base**: las **161 unidades** (9 series) se guardan en la base como la flota base de la empresa, **oculta** del panel (no se muestra). Si la base está vacía, se siembra automáticamente y se aplica la flota del día.
- **Botón "Cargar flota de hoy (29)"**: aplica el inventario diario y marca esas unidades como la flota visible (las que salen del inventario quedan ocultas).
- **Alertas visuales** de vencimientos: rojo (≤ 30 días o vencido), ámbar (≤ 60 días), verde (ok).
- **Bot de Telegram** para consultar la flota desde el celular.
- **Sincronización diaria con la intranet**: un workflow de GitHub Actions extrae la flota de la intranet de Budget (login + scraping con `agent-browser`) cada día a las 05:30 UTC y la envía al panel vía el endpoint `/ingest-flota` de Convex. El panel muestra el último snapshot (unidades en parqueo E1/E7/E12, kilometraje, combustible y estado).

## Stack

- [Vite](https://vitejs.dev) + React + TypeScript
- [Convex](https://convex.dev) (backend y base de datos)
- [Tailwind CSS](https://tailwindcss.com) + Framer Motion

## Comandos

```bash
bun install          # instala dependencias
bun run preview      # convex dev + Vite juntos (usado por el preview)
bun run dev          # solo el dev server de Vite
bun run build        # build de producción (dist/)
bun tsc -b --noEmit  # typecheck
```

> En el preview de Freebuff, el comando configurado es `bun run preview`, que levanta
> `convex dev --start "vite --host 0.0.0.0"` (backend de Convex en el puerto 3210 + Vite en el 5173).

## Variables de entorno

| Variable | Qué es | Dónde se configura |
|---|---|---|
| `VITE_CONVEX_URL` | URL del backend de Convex | `convex dev` la escribe en `.env.local` (`http://127.0.0.1:3210`); en el preview del workspace se usa la URL proxy del puerto 3210 |
| `VITE_CONVEX_SITE_URL` | URL de acciones HTTP | `.env.local` (la escribe `convex dev`) |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | API Keys (secreto) |
| `FLOTA_SYNC_SECRET` | Secreto compartido para el endpoint `/ingest-flota` | API Keys (secreto) + GitHub secret con el mismo valor |

## Sincronización diaria con la intranet

El workflow [`.github/workflows/flota.yml`](.github/workflows/flota.yml) corre **cada hora dentro del horario de trabajo: 15:00–08:00 del día siguiente** en hora Perú (UTC−5 → 20:00–13:00 UTC), y a pedido con *Run workflow*:

1. Se loguea en la intranet con `agent-browser` (`extraer_flota.js`, secrets `BUDGET_USER` / `BUDGET_PASS`).
2. Extrae la flota del día y guarda el snapshot en `public/flota_data.json`.
3. Envía el JSON a `<CONVEX_SYNC_URL>` (el endpoint `/ingest-flota`) con el header `x-flota-secret`.
4. Opcionalmente envía el resumen por Telegram (`TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID`).

Secrets de GitHub necesarios:

| Secret | Valor |
|---|---|
| `BUDGET_USER` / `BUDGET_PASS` | Credenciales de la intranet |
| `CONVEX_SYNC_URL` | URL pública del endpoint, ej. `https://<proyecto>.convex.site/ingest-flota` (para que funcione aunque el workspace esté apagado, el backend de Convex debe estar desplegado en Convex Cloud) |
| `FLOTA_SYNC_SECRET` | Mismo valor que el `FLOTA_SYNC_SECRET` configurado en API Keys |
| `TELEGRAM_TOKEN` / `TELEGRAM_CHAT_ID` | Opcionales: resumen por Telegram |

El endpoint guarda un snapshot por fecha, reemplaza el del mismo día en reintentos y poda el historial a los 30 días más recientes.

## Bot de Telegram

1. Crea tu bot con **@BotFather** en Telegram (`/newbot`) y guarda el token.
2. Configura `TELEGRAM_BOT_TOKEN` en **API Keys**.
3. Registra el webhook:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<CONVEX_URL>/telegram-webhook
```

Comandos disponibles:

- `/flota` — lista todas las unidades con su estado
- `/unidad <nº o texto>` — detalle de una unidad
- `/ayuda` — muestra la ayuda

## Estructura

```
src/
├── convex/               # Backend (schema, funciones, webhook de Telegram)
│   ├── schema.ts         # Tablas: vehicles + intranetSnapshots
│   ├── vehicles.ts       # CRUD + importación de flota total y flota del día
│   ├── intranet.ts       # Snapshot diario de la intranet (upsert + consultas)
│   ├── fleetCatalog.ts   # Flota base (161 unidades en 9 series)
│   ├── todayFleet.ts     # Flota del día (29 unidades del formulario diario)
│   └── http.ts           # Webhook de Telegram + endpoint /ingest-flota
├── pages/                # Landing + dashboard
└── components/           # UI
```

## Nota

La carpeta `legacy/` contiene archivos de una versión estática anterior del repo; la app actual no los usa. Los archivos sueltos en la raíz (`extraer_flota.js`, `parse_*.py`, `informe_flota_template.html`) son de esa versión anterior y no forman parte de la app.
