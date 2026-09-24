# Paso a paso: despliegue (GitHub + Render + Vercel)

Esta guía publica **Afirmative Pill** en internet a partir de **un solo repositorio de GitHub**:

| Pieza | Dónde | Carpeta | Qué publica | URL de ejemplo |
|---|---|---|---|---|
| Base de datos | Supabase | `database` | PostgreSQL (write model + read model) | — |
| Backend | **Render** (Web Service) | `backend` | Apollo Server persistente: HTTP **y WebSocket** en `/graphql` | `https://afirmative-pill-api.onrender.com/graphql` |
| Frontend | **Vercel** | `frontend` | La SPA de React (archivos estáticos) | `https://afirmative-pill.vercel.app` |

⏱️ Tiempo estimado: 30 minutos.

> ✅ **Por qué Render para el backend:** es un servidor Node **siempre en ejecución** (no serverless), así que admite **WebSocket**. Las **GraphQL Subscriptions** (seguimiento del pedido y bandeja del farmacéutico en tiempo real) funcionan en producción igual que en local.
>
> ⚠️ **Plan gratuito de Render:** el servicio **se duerme tras 15 minutos sin tráfico**. La primera petición después de dormir tarda **unos 50 segundos**. Antes de grabar o presentar, lee la [sección 6](#6-antes-de-grabar-o-presentar-despertar-el-backend).

---

## 0. Requisitos previos

- La base de datos de Supabase lista ([DEPLOY_SUPABASE.md](DEPLOY_SUPABASE.md)).
- La URI del **Session pooler** de Supabase (puerto **5432**) a mano, con tu contraseña. Es la misma que usas en `backend/.env` para el servidor local.
  > No uses la *Direct connection* (solo IPv6) ni el *Transaction pooler* (6543, pensado para serverless).
- **Git** instalado (`git --version` en una terminal debe responder).
- Cuentas en:
  - GitHub: <https://github.com>
  - Render: <https://render.com> (puedes registrarte con GitHub; el plan gratuito no pide tarjeta).
  - Vercel: <https://vercel.com> (también con GitHub).

---

## 1. Subir el código a GitHub

1. En GitHub crea un repositorio nuevo, por ejemplo `afirmative-pill`, **sin** README, `.gitignore` ni licencia (el proyecto ya los tiene). Puede ser público o privado.
2. Si es la primera vez que usas Git en este computador, configura tu nombre y correo (solo una vez):

   ```bash
   git config --global user.name "Tu Nombre"
   git config --global user.email "tu-correo@ejemplo.com"
   ```

3. En una terminal, desde la carpeta raíz del proyecto (`TALLER3C2`):

   ```bash
   git init
   git add .
   git status
   ```

4. **Revisa la salida de `git status`**: **no** debe aparecer ningún archivo `.env` (solo los `.env.example`). El `.gitignore` ya los excluye, junto con `node_modules/`, `dist/` y tus notas personales.
5. Crea el primer commit y súbelo:

   ```bash
   git commit -m "Afirmative Pill: GraphQL + CQRS con Apollo y Supabase"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/afirmative-pill.git
   git push -u origin main
   ```

   > En Windows, el primer `git push` abre una ventana del navegador para iniciar sesión en GitHub. Acepta y vuelve a la terminal.

6. Recarga la página del repositorio en GitHub: deben verse las carpetas `backend`, `frontend`, `database` y `docs`.

---

## 2. Desplegar el backend en Render

### 2.1 Crear el servicio

1. Entra a <https://dashboard.render.com> y pulsa **New +** → **Web Service**.
2. En **Source Code**, pestaña **Git Provider**, conecta tu cuenta de GitHub si aún no lo has hecho y elige el repositorio `afirmative-pill`. Pulsa **Connect**.
   > Si el repositorio no aparece, pulsa **Configure account** (o *Configure GitHub*) y dale acceso a Render.
3. Completa el formulario:

   | Campo | Valor |
   |---|---|
   | **Name** | `afirmative-pill-api` (define la URL `https://afirmative-pill-api.onrender.com`) |
   | **Language** | `Node` |
   | **Branch** | `main` |
   | **Region** | La más cercana a tu región de Supabase. Si Supabase está en São Paulo (`sa-east-1`) o en EE. UU., elige **Virginia (US East)** u **Ohio (US East)**. ⚠️ No se puede cambiar después. |
   | **Root Directory** | `backend` |
   | **Build Command** | `npm install --include=dev && npm run build` |
   | **Start Command** | `npm start` |
   | **Instance Type** | **Free** |

   > `--include=dev` es necesario: TypeScript (que compila el backend) es una dependencia de desarrollo y, sin esa opción, podría no instalarse.

### 2.2 Variables de entorno

4. En la sección **Environment Variables** agrega estas variables (botón **Add Environment Variable**, o **Add from .env** para pegarlas todas juntas):

   | Key | Value |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `DATABASE_URL` | URI del **Session pooler** de Supabase (puerto **5432**) con tu contraseña |
   | `DATABASE_SSL` | `true` |
   | `DATABASE_POOL_MAX` | `5` |
   | `JWT_SECRET` | una cadena larga y aleatoria (ver abajo) |
   | `JWT_EXPIRES_IN` | `8h` |
   | `CORS_ORIGIN` | `*` por ahora; se restringe en el paso 4 |
   | `PROJECTION_DELAY_MS` | `1500` |
   | `AUTO_APPROVE_DELAY_MS` | `4000` |
   | `GRAPHQL_INTROSPECTION` | `true` (habilita Apollo Sandbox para la demo) |
   | `LOG_SQL` | `true` |
   | `DISABLE_DATALOADER` | `false` |

   Para generar el `JWT_SECRET`, ejecuta en cualquier terminal (funciona igual en PowerShell):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   > ❌ **No agregues `PORT`.** Render asigna el puerto automáticamente y el backend ya lo lee de esa variable.
   >
   > 💡 `DATABASE_POOL_MAX=5` deja conexiones libres en el Session pooler de Supabase para tu servidor local. Si solo usarás el de Render, puedes subirlo a `10`.

### 2.3 Desplegar y verificar

5. Pulsa **Deploy Web Service**. La primera compilación tarda de 3 a 5 minutos. En la pestaña **Logs** debes ver al final algo como:

   ```
   🚀 GraphQL (HTTP)      → http://localhost:10000/graphql
   🔌 Subscriptions (WS)  → ws://localhost:10000/graphql
   ==> Your service is live 🎉
   ```

   > Que diga `localhost:10000` es normal: es el puerto interno del contenedor. La URL pública es la que Render muestra arriba, junto al nombre del servicio.

6. Copia la URL pública del servicio (arriba a la izquierda, por ejemplo `https://afirmative-pill-api.onrender.com`). Si el nombre ya estaba tomado, Render le agrega un sufijo: **usa siempre la URL que te muestra Render**.
7. **Verifica:** abre `https://<tu-backend>.onrender.com/graphql`. Debe cargar **Apollo Sandbox**. Ejecuta:

   ```graphql
   query {
     medications(first: 3) {
       totalCount
       edges { node { name price category { name } } }
     }
   }
   ```

   La respuesta debe mostrar `totalCount: 50`.
8. Anota la URL del backend; la necesitas en el siguiente paso.

> 🔎 Los logs del servidor (cada SQL, lotes de DataLoader, conexiones WebSocket y subscriptions) se ven en tiempo real en la pestaña **Logs** del servicio. Son útiles para mostrar el N+1 y la consistencia eventual en el video.

---

## 3. Desplegar el frontend en Vercel

1. En Vercel pulsa **Add New…** → **Project**.
2. En **Import Git Repository** elige `afirmative-pill` y pulsa **Import**. Si no aparece, pulsa **Adjust GitHub App Permissions** y dale acceso.
3. En **Configure Project**:
   - **Project Name:** `afirmative-pill`.
   - **Root Directory:** pulsa **Edit** y selecciona la carpeta **`frontend`**.
   - **Framework Preset:** `Vite` (se detecta solo).
   - **Build and Output Settings:** deja los valores por defecto. `frontend/vercel.json` ya define el build, la carpeta `dist` y la regla para que las rutas de la SPA funcionen al recargar.
4. Despliega **Environment Variables** y agrega (con la URL real de tu backend):

   | Key | Value |
   |---|---|
   | `VITE_GRAPHQL_HTTP_URL` | `https://<tu-backend>.onrender.com/graphql` |
   | `VITE_GRAPHQL_WS_URL` | `wss://<tu-backend>.onrender.com/graphql` |
   | `VITE_ENABLE_SUBSCRIPTIONS` | `true` |

   > Fíjate en el protocolo: **`https://`** para HTTP y **`wss://`** (con doble *s*) para WebSocket. Desde una página `https` el navegador bloquea `ws://`.
   >
   > Las variables `VITE_*` se **incrustan al compilar**. Si las cambias después, tienes que hacer **Redeploy**.

5. Pulsa **Deploy** (≈1 minuto).
6. Abre la URL del frontend, por ejemplo `https://afirmative-pill.vercel.app`, y comprueba que carga el catálogo.
   > Si el backend estaba dormido, el catálogo puede tardar hasta un minuto la primera vez. Es normal (ver sección 6).
7. En el menú lateral, la tarjeta **Canal GraphQL único** debe mostrar la URL de Render y **"Tiempo real · Subscriptions"** con el punto verde.

---

## 4. Restringir CORS al dominio del frontend

1. En Render abre el servicio `afirmative-pill-api` → pestaña **Environment**.
2. Edita `CORS_ORIGIN` con la URL exacta del frontend, **sin `/` final**:

   ```
   https://afirmative-pill.vercel.app
   ```

   Puedes poner varios orígenes separados por coma, por ejemplo `https://afirmative-pill.vercel.app,http://localhost:5173`.
3. Pulsa **Save Changes** y elige **Save and deploy** (o **Save, rebuild, and deploy**). Render reinicia el servicio con el cambio (≈1–3 minutos).
4. Recarga el frontend y comprueba que el catálogo sigue cargando.

---

## 5. Prueba final en producción

1. Abre el frontend e ingresa con la cuenta demo `paciente@afirmativepill.co` / `Paciente123*`.
2. Agrega un medicamento de venta libre y uno con fórmula, llena los datos de la fórmula (documento del paciente `1000000001`) y confirma el pedido.
3. Verás "Pedido recibido · preparando resumen…" (consistencia eventual) y luego el seguimiento con el indicador **"En vivo (subscription)"**.
4. En otra ventana de incógnito ingresa como `farmacia@afirmativepill.co` / `Farmacia123*`. En la bandeja aparece **"Feed en vivo (orderFeed)"**. Aprueba la fórmula y despacha: la ventana del paciente cambia **al instante**, sin recargar.
5. Abre **DevTools → Network**:
   - **Fetch/XHR:** todas las llamadas van a `…onrender.com/graphql`.
   - **WS:** hay una conexión a `wss://…onrender.com/graphql`; en su pestaña **Messages** verás llegar los eventos de la subscription.

También puedes ejecutar la prueba automática (26 verificaciones, **incluidas las subscriptions**) contra producción, desde `backend/`:

```bash
# macOS / Linux / Git Bash
GRAPHQL_URL=https://<tu-backend>.onrender.com/graphql npm run smoke
```

```powershell
# Windows PowerShell
$env:GRAPHQL_URL="https://<tu-backend>.onrender.com/graphql"; npm run smoke
```

---

## 6. Antes de grabar o presentar: despertar el backend

En el plan gratuito, Render duerme el servicio tras **15 minutos sin tráfico**. Al dormirse se cortan las subscriptions abiertas y la siguiente petición tarda unos 50 segundos.

- **Opción simple:** 2 minutos antes de grabar, abre `https://<tu-backend>.onrender.com/graphql` y espera a que cargue Apollo Sandbox. Luego abre el frontend. Mientras lo estés usando, no se duerme.
- **Opción automática (opcional):** crea un monitor HTTP gratuito en un servicio de *uptime* (por ejemplo UptimeRobot) que visite la URL del backend cada 10 minutos. Las 750 horas gratuitas mensuales de Render alcanzan para tener un servicio encendido todo el mes.

---

## 7. Despliegues siguientes

Cada `git push` a `main` redepliega **automáticamente** el backend en Render y el frontend en Vercel:

```bash
git add .
git commit -m "Describe tu cambio"
git push
```

> 💡 **Opcional:** para que Render no recompile el backend cuando solo cambias el frontend, ve al servicio → **Settings → Build & Deploy → Build Filters** y en **Included Paths** agrega `backend/**`.

---

## 8. Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El catálogo tarda ~1 minuto en cargar la primera vez | El servicio de Render estaba dormido | Normal en el plan gratuito. Ver [sección 6](#6-antes-de-grabar-o-presentar-despertar-el-backend) |
| Build de Render falla con `tsc: not found` o `Cannot find module 'typescript'` | No se instalaron las dependencias de desarrollo | Build Command: `npm install --include=dev && npm run build` |
| Build falla por versión de Node o sintaxis no soportada | Render usó una versión de Node antigua | Agrega `NODE_VERSION=22` en **Environment** y vuelve a desplegar |
| Logs: `Tenant or user not found` | El usuario de la URI debe ser `postgres.<ref>` | Copia la URI completa del **Session pooler** desde **Connect** en Supabase |
| Logs: timeout o `ENOTFOUND` conectando a la BD | Se usó la *Direct connection* (solo IPv6) | Usa la URI del **Session pooler** (puerto 5432) |
| Logs: `MaxClientsInSessionMode: max clients reached` | Entre Render y tu servidor local se agotaron las conexiones del pooler | Baja `DATABASE_POOL_MAX` a `3`–`5` o apaga el backend local |
| En el navegador: `CORS policy: No 'Access-Control-Allow-Origin'` | `CORS_ORIGIN` no coincide con la URL del frontend | Corrige la variable en Render (sin `/` final) y guarda con **Save and deploy** |
| El frontend sigue llamando a `localhost:4000` | `VITE_GRAPHQL_HTTP_URL` no estaba definida al compilar | Defínela en Vercel y haz **Redeploy** del frontend |
| El menú lateral dice "Tiempo real · Polling" | `VITE_ENABLE_SUBSCRIPTIONS` no es `true` | Ponla en `true` en Vercel y haz **Redeploy** |
| No llegan las actualizaciones en vivo; en DevTools la conexión WS falla | `VITE_GRAPHQL_WS_URL` usa `ws://` o apunta a otra URL | Debe ser `wss://<tu-backend>.onrender.com/graphql`; corrige y haz **Redeploy** del frontend |
| `404` al recargar `/pedidos/…` en el frontend | Falta la regla SPA | `frontend/vercel.json` ya la incluye; verifica que el Root Directory sea `frontend` |
| Render muestra `Deploy failed` sin error claro | Error en el Start Command o una variable faltante | Revisa **Logs**: el backend indica qué variable falta (`DATABASE_URL`, `JWT_SECRET`) |

---

## Anexo: backend en Vercel (alternativa sin subscriptions)

El backend también puede correr como función serverless en Vercel (`backend/vercel.json` y `src/vercel-handler.ts` siguen en el proyecto). En ese modo **no hay WebSocket**: el frontend usa *polling*. Solo úsalo como plan B si Render no está disponible.

1. En Vercel crea otro proyecto desde el mismo repositorio con **Root Directory** `backend` y **Framework Preset** `Other`.
2. Usa las mismas variables del paso 2.2, pero con la URI del **Transaction pooler** de Supabase (puerto **6543**) y `DATABASE_POOL_MAX=3`. No hace falta `NODE_VERSION`.
3. En el proyecto del frontend cambia `VITE_GRAPHQL_HTTP_URL` a `https://<tu-backend>.vercel.app/graphql`, `VITE_ENABLE_SUBSCRIPTIONS` a `false`, borra `VITE_GRAPHQL_WS_URL` y haz **Redeploy**.
4. Para la prueba automática agrega `SKIP_WS=true` al comando `npm run smoke`.
