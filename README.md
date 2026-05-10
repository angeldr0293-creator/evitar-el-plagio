# ZeroCopy IA

Proyecto web de ZeroCopy IA para gestionar usuarios, solicitudes, paneles, archivos, profesores y notificaciones.

## Instalacion

```bash
npm install
```

## Configuracion

Copia `.env.example` como `.env` y ajusta los valores locales o de hosting:

```text
ADMIN_EMAIL=admin@zerocopyia.com
ADMIN_PASSWORD=cambia-esta-clave
PORT=5173
HOST=0.0.0.0
PUBLIC_APP_URL=https://zerocopyia.com
ALLOWED_ORIGINS=https://zerocopyia.com,https://www.zerocopyia.com,http://localhost:5173
CANONICAL_HOST=zerocopyia.com
SESSION_SECRET=cambia-este-secreto-largo-y-privado
EMAIL_PROVIDER=resend
EMAIL_FROM="ZeroCopy IA <resolviendot@gmail.com>"
EMAIL_REPLY_TO=resolviendot@gmail.com
RESEND_API_KEY=re_xxxxxxxxx
TURNSTILE_SITE_KEY=0x4AA...
TURNSTILE_SECRET_KEY=0x4AA...
```

El archivo `.env` no debe subirse al repositorio.
`ALLOWED_ORIGINS` acepta uno o varios origenes separados por coma. En desarrollo puedes dejar `http://localhost:5173`; en produccion usa `https://zerocopyia.com` y `https://www.zerocopyia.com`.

## Ejecutar el proyecto

```bash
npm run dev
```

El servidor queda disponible en:

```text
http://localhost:5173/
```

Para hosting, el comando de inicio esperado es:

```bash
npm start
```

Paginas principales:

- `/`
- `/404.html`
- `/admin.html`
- `/panel.html`
- `/profesor.html`
- `/registro.html`
- `/solicitar.html`
- `/pago.html`
- `/precios.html`
- `/soporte.html`

## Resetear datos

```bash
npm run reset
```

Este comando reinicia la base de datos SQLite en `server/data/app.sqlite` y crea backup previo en `server/data/backups/`.

## Backups

```bash
npm run backup
```

Este comando copia la base SQLite y `server/uploads/` dentro de `server/data/backups/`.

## Restaurar backup

1. Deten el servidor.
2. Haz una copia del estado actual antes de reemplazar archivos.
3. Copia el `app.sqlite` respaldado a `server/data/app.sqlite`.
4. Copia la carpeta `uploads/` respaldada a `server/uploads/`.
5. Inicia el servidor con `npm start` o `npm run dev`.

No restaures backups de origen desconocido.

## Build

```bash
npm run build
```

El build de Vite toma como raiz la carpeta `client/` y genera salida en `dist/`.

## Despliegue

1. Instala dependencias:

```bash
npm install
```

2. Crea `.env` desde `.env.example` y ajusta produccion:

```text
NODE_ENV=production
ADMIN_EMAIL=admin@zerocopyia.com
ADMIN_PASSWORD=cambia-esta-clave
PORT=5173
HOST=0.0.0.0
PUBLIC_APP_URL=https://zerocopyia.com
ALLOWED_ORIGINS=https://zerocopyia.com,https://www.zerocopyia.com
CANONICAL_HOST=zerocopyia.com
SESSION_SECRET=cambia-este-secreto-largo-y-privado
EMAIL_PROVIDER=resend
EMAIL_FROM="ZeroCopy IA <resolviendot@gmail.com>"
EMAIL_REPLY_TO=resolviendot@gmail.com
RESEND_API_KEY=re_xxxxxxxxx
TURNSTILE_SITE_KEY=0x4AA...
TURNSTILE_SECRET_KEY=0x4AA...
```

3. Configura el hosting para ejecutar:

```bash
npm start
```

4. Asegura persistencia para:

- `server/data/app.sqlite`
- `server/uploads/`
- `server/logs/`

Si el hosting no conserva disco local, migra esos recursos a servicios externos antes de produccion: base gestionada, S3/Supabase Storage/Cloudinary y logging externo.

### Railway

Configuracion recomendada para Railway:

- **Start Command:** `npm start`
- **Build Command:** dejar automatico o usar `npm install`
- **Root Directory:** raiz del repositorio, donde esta `package.json`
- **Node:** `package.json` exige `>=22.5.0` porque la app usa `node:sqlite`
- **Volume:** crear un volumen en el servicio y montarlo, por ejemplo, en `/app/storage`

Railway define automaticamente `RAILWAY_VOLUME_MOUNT_PATH` cuando el volumen esta conectado. La app detecta esa variable y guarda ahi:

- SQLite: `$RAILWAY_VOLUME_MOUNT_PATH/data/app.sqlite`
- Uploads: `$RAILWAY_VOLUME_MOUNT_PATH/uploads/`
- Logs: `$RAILWAY_VOLUME_MOUNT_PATH/logs/`

No definas `PORT` manualmente en Railway; Railway lo inyecta. Si quieres probar una ruta alternativa fuera de Railway, puedes definir `APP_STORAGE_ROOT=/ruta/persistente`.

Variables recomendadas en Railway:

```text
NODE_ENV=production
HOST=0.0.0.0
PUBLIC_APP_URL=https://zerocopyia.com
ALLOWED_ORIGINS=https://zerocopyia.com,https://www.zerocopyia.com
CANONICAL_HOST=zerocopyia.com
ADMIN_EMAIL=admin@zerocopyia.com
ADMIN_PASSWORD=crea-una-clave-larga
SESSION_SECRET=crea-un-secreto-largo-y-unico
EMAIL_PROVIDER=resend
EMAIL_FROM="ZeroCopy IA <resolviendot@gmail.com>"
EMAIL_REPLY_TO=resolviendot@gmail.com
RESEND_API_KEY=re_xxxxxxxxx
TURNSTILE_SITE_KEY=0x4AA...
TURNSTILE_SECRET_KEY=0x4AA...
```

En Railway, agrega los dominios personalizados `zerocopyia.com` y `www.zerocopyia.com` desde el servicio y copia en Hostinger los registros DNS que Railway te indique. Railway puede pedir un `CNAME`, `A`/`ALIAS` o `TXT` para enrutar y verificar propiedad.

## Dominio y produccion

- Dominio principal: `https://zerocopyia.com`. Tambien se deja permitido `https://www.zerocopyia.com`.
- Usa ese dominio en `PUBLIC_APP_URL`.
- Usa el mismo origen en `ALLOWED_ORIGINS`.
- Usa `CANONICAL_HOST=zerocopyia.com` para redirigir `www.zerocopyia.com` al dominio principal en produccion.
- En produccion, `NODE_ENV=production` activa HTTPS obligatorio y HSTS.
- No compartas `ADMIN_PASSWORD`, `SESSION_SECRET` ni `RESEND_API_KEY`.
- Usa un `SESSION_SECRET` largo, unico y privado.

### DNS en Hostinger

Cuando el servicio exista en Railway, configura los registros que Railway muestre para:

- `zerocopyia.com`
- `www.zerocopyia.com`

Luego confirma que ambos carguen con HTTPS y que `https://www.zerocopyia.com` redirija a `https://zerocopyia.com`.

## Checklist de pruebas

### Flujo completo local

1. Crear cuenta de cliente.
2. Iniciar sesion como cliente.
3. Comprar o registrar plan/creditos.
4. Enviar solicitud con archivo permitido.
5. Ver solicitud en panel del cliente.
6. Entrar como admin.
7. Ver cliente, pago/suscripcion y solicitud.
8. Crear profesor si no existe.
9. Asignar profesor a la solicitud.
10. Entrar como profesor.
11. Ver trabajo asignado y descargar/revisar archivo.
12. Cambiar estado a `Descargado/visto` y luego `Trabajando`.
13. Subir entrega.
14. Ver entrega en panel del cliente.
15. Probar ruta invalida y confirmar pagina 404.

### Pruebas desde celular

Antes de hosting publico, revisar en Android/iPhone real:

- Registro e inicio de sesion.
- Compra/plan y solicitud.
- Selector de telefono.
- Subida de archivo desde el movil.
- Panel de cliente.
- Panel admin en pantalla pequena.
- Panel profesor y subida de entrega.
- Menu, botones, textos largos y modales/notificaciones.
- Descarga de entrega.

Tambien revisar con viewport movil en navegador de escritorio, pero eso no reemplaza la prueba en dispositivo real.

## Dependencias

Dependencias actuales:

- Produccion: `express`
- Desarrollo/build: `vite`

Comandos recomendados:

```bash
npm audit
npm outdated
```

No agregues librerias para funciones pequenas si pueden resolverse con codigo local mantenible.

## Estructura del proyecto

```text
zerocopy-ia/
├── server/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── auth/
│   │   └── auth.js
│   ├── data/
│   │   ├── app.sqlite
│   │   └── data.json
│   └── utils/
│       └── reset-data.js
├── client/
│   ├── index.html
│   ├── 404.html
│   ├── admin.html
│   ├── panel.html
│   ├── profesor.html
│   ├── formulario.html
│   ├── pago.html
│   ├── precios.html
│   ├── registro.html
│   ├── solicitar.html
│   ├── soporte.html
│   ├── js/
│   │   └── notifications.js
│   ├── css/
│   │   └── notifications.css
│   └── assets/
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Notas de organizacion

- `server/server.js` sirve los archivos publicos desde `client/`.
- `server/data/app.sqlite` conserva el estado de usuarios, solicitudes y suscripciones.
- `server/uploads/` guarda los archivos subidos en disco y la base solo conserva metadatos/URL. Las descargas pasan por `/api/files/:storageKey`, con sesion y permisos. En hosting puede reemplazarse por Supabase Storage, S3, Cloudinary o Firebase Storage.
- `server/logs/app.log` registra errores importantes y actividad critica.
- `server/logs/support.log` guarda los mensajes enviados desde el formulario visible de soporte.
- `server/logs/email-outbox.log` guarda correos enviados o en cola cuando no hay proveedor configurado.
- Limites de archivos: maximo 5 archivos por solicitud, 10 MB por archivo, 15 MB total por solicitud y 2 MB para entregas del profesor.
- Tipos permitidos: `.pdf`, `.doc`, `.docx`, `.txt`; el backend valida extension, nombre seguro y firma basica del archivo.
- `server/data/data.json` queda como archivo heredado para migrar datos antiguos si la base SQLite esta vacia.
- `server/auth/auth.js` se mantiene separado como modulo de autenticacion usado por el cliente.
- `client/js/notifications.js` y `client/css/notifications.css` contienen los recursos compartidos de notificaciones.

## Seguridad basica

- En produccion (`NODE_ENV=production`) se exige HTTPS y se activa HSTS.
- Hay rate limiting para login, registro, solicitudes y acciones administrativas.
- Registro incluye rate limiting, honeypot, tiempo minimo de envio y Cloudflare Turnstile cuando `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` estan configuradas. Sin Turnstile, queda activo el fallback local de verificacion simple.
- Se aplican headers de seguridad similares a Helmet.
- No se sirven `.env`, SQLite, backups, logs ni carpetas internas del servidor.
- Las paginas legales estan en `/privacidad.html`, `/terminos.html`, `/reembolsos.html` e `/integridad.html`.
- Contacto visible: formulario de soporte, correo publico `resolviendot@gmail.com` y WhatsApp `+507 0000-0000`.
- Datos del negocio visibles: nombre comercial `ZeroCopy IA`, dominio `zerocopyia.com`, ubicacion general Panama, correo publico `resolviendot@gmail.com`, Instagram `@resolviendotrabajos` y WhatsApp `+507 0000-0000`.
- Pagos: la pantalla muestra PayPal y Banco General como metodos automaticos por conectar. El respaldo manual Yappy/transferencia crea pagos `Pendiente` con monto, referencia y comprobante; solo pasan a `Pagado` con confirmacion real del proveedor o revision del admin.
- Panel admin controlado: usuarios, profesores, solicitudes, pagos/suscripciones y estados se gestionan desde acciones del panel y endpoints especificos, sin editar datos manualmente.
- Operacion interna: las cuentas, solicitudes, pagos, archivos, estados, entregas y soporte se gestionan exclusivamente dentro de la plataforma para evitar seguimiento manual por chats externos.
- Notificaciones: la app muestra confirmaciones por pantalla y campana interna. El correo real se envia solo en tres casos: cuando el cliente envia un trabajo, cuando soporte/admin envia un mensaje manual al cliente y cuando el profesor sube la entrega final. WhatsApp queda publicado como contacto de soporte, pero no envia mensajes automaticos.
- Estados visibles: cliente ve pendiente de pago, recibido, asignado, en proceso, listo o entregado; profesor ve asignado, descargado/visto, trabajando y entrega subida.
