# 🚗 Reporte de Flota — Budget Perú (GitHub, costo $0)

Tu app de flota que se actualiza **cada hora automáticamente**, se ve desde el **celular** y te manda la flota completa por **Telegram**. Sin pagar nada y sin dejar tu PC encendida.

## Cómo funciona

```
GitHub (gratis)
 ├── Acción programada → corre tu app CADA HORA
 ├── Extrae la flota de la intranet (login automático)
 ├── Actualiza el reporte → GitHub Pages (URL para tu celular)
 └── Envía la flota completa por Telegram (opcional)
```

## 🛠️ Configuración (una sola vez, ~15 minutos)

### Paso 1 — Crea tu cuenta de GitHub (gratis)
1. Entra a https://github.com/signup y crea tu cuenta
2. **Confirma tu correo** (te llega un email)

### Paso 2 — Crea el repositorio (privado, para que nadie más vea los datos)
1. Clic en el botón **"+"** (arriba a la derecha) → **New repository**
2. Nombre: `flota-budget`
3. **IMPORTANTE:** marca **Private** (privado — los datos de la flota son de la empresa)
4. Clic en **Create repository**
5. En la página que aparece, clic en **"uploading an existing file"**
6. Arrastra **todos los archivos de esta carpeta** (`flota_github/`):
   - `extraer_flota.js`
   - `informe_flota_template.html`
   - la carpeta `.github` (completa)
   - `README.md`
   - ⚠️ **NO subas** `config.json` (si existe — tiene credenciales y está excluido)
7. Clic en **Commit changes**

### Paso 3 — Guarda las credenciales (Secrets)
1. En tu repositorio: pestaña **Settings** → menú izquierdo **Secrets and variables** → **Actions**
2. Clic en **New repository secret** y crea 4 secretos:
   - `BUDGET_USER` → tu usuario de la intranet (`73206264`)
   - `BUDGET_PASS` → tu contraseña
   - `TELEGRAM_TOKEN` → el token de tu bot (paso 5)
   - `TELEGRAM_CHAT_ID` → tu ID de chat (paso 5)
   *(Los secretos van cifrados; nadie los ve, ni siquiera en el historial)*

### Paso 4 — Activa GitHub Pages (para verlo desde el celular)
1. En tu repositorio: **Settings** → menú izquierdo **Pages**
2. En **Source** elige **"GitHub Actions"**
3. Listo — el reporte quedará en: `https://TU-USUARIO.github.io/flota-budget/`
4. Guárdate esa dirección en el celular (o agrégala a la pantalla de inicio)

### Paso 5 — Crea el bot de Telegram (para recibir la flota)
1. Instala **Telegram** en tu celular y crea tu cuenta
2. Busca **@BotFather** → escribe `/newbot` → ponle nombre (ej: "Flota Budget") → te da un **token**
3. Abre tu bot (el nombre de usuario que elegiste) y escribe `/start`
4. Para obtener tu **ID de chat**: busca **@userinfobot** y escribe `/start` — te dirá tu ID numérico
5. Pon el **token** y el **ID** en los secretos del Paso 3 (TELEGRAM_TOKEN y TELEGRAM_CHAT_ID)

### Paso 6 — Pruébalo
1. En tu repositorio: pestaña **Actions** → clic en el workflow **"Reporte de Flota"** → botón **"Run workflow"**
2. Espera ~2-3 minutos (instala Chrome la primera vez)
3. Revisa que el run termine en verde ✅
4. Abre la URL del Paso 4 en tu celular y mira tu bot de Telegram

Después de eso, **todo es automático cada hora** 🎉

## ⚠️ Notas importantes

- **Horario:** la acción corre cada hora en el minuto 5 (hora UTC). Para cambiar la frecuencia, edita la línea `cron` del archivo `.github/workflows/flota.yml` (hay ejemplos de cada 2 horas y 3 veces al día).
- **Minutos gratis:** GitHub da 2,000 minutos/mes para repos privados. Con caché activado, cada corrida usa ~2-3 min → ~1,500/mes. Cabe bien. Si algún mes se agota, GitHub pausa las acciones hasta el 1ro del mes siguiente (el reporte queda con la última versión).
- **Telegram opcional:** si no creas el bot, el reporte igual se actualiza cada hora; solo no llegarían mensajes. El script lo detecta y continúa.
- **Seguridad:** el repositorio es PRIVADO, así que el reporte solo lo ves tú (quien tenga acceso al repo). Las credenciales van en Secrets (cifradas), nunca en los archivos.

## 🧪 Probar en tu PC (opcional)

```bash
# Con Node.js instalado:
node extraer_flota.js              # extrae de verdad y genera public/
node extraer_flota.js --mensaje    # muestra el mensaje de Telegram sin enviarlo
```

## 📁 Archivos

| Archivo | Qué es |
|---|---|
| `extraer_flota.js` | La app: login + extracción + reporte + Telegram |
| `informe_flota_template.html` | Plantilla del reporte visual |
| `.github/workflows/flota.yml` | La programación: cada hora + publicación web |
| `public/` | El reporte generado (se actualiza solo, no lo edites) |
