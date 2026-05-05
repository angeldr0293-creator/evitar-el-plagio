# Evitar el Plagio

Proyecto web para gestionar usuarios, solicitudes, paneles y notificaciones de Originalidad Academica.

## Instalacion

```bash
npm install
```

## Ejecutar el proyecto

```bash
npm run dev
```

El servidor queda disponible en:

```text
http://localhost:5173/
```

Paginas principales:

- `/`
- `/admin.html`
- `/panel.html`
- `/profesor.html`
- `/registro.html`
- `/solicitar.html`
- `/pago.html`
- `/precios.html`

## Resetear datos

```bash
npm run reset
```

Este comando reinicia el archivo de datos en `server/data/data.json`.

## Build

```bash
npm run build
```

El build de Vite toma como raiz la carpeta `client/` y genera salida en `dist/`.

## Estructura del proyecto

```text
evitar-el-plagio/
├── server/
│   ├── server.js
│   ├── routes/
│   ├── controllers/
│   ├── auth/
│   │   └── auth.js
│   ├── data/
│   │   └── data.json
│   └── utils/
│       └── reset-data.js
├── client/
│   ├── index.html
│   ├── admin.html
│   ├── panel.html
│   ├── profesor.html
│   ├── formulario.html
│   ├── pago.html
│   ├── precios.html
│   ├── registro.html
│   ├── solicitar.html
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
- `server/data/data.json` conserva el estado de usuarios, solicitudes y suscripciones.
- `server/auth/auth.js` se mantiene separado como modulo de autenticacion usado por el cliente.
- `client/js/notifications.js` y `client/css/notifications.css` contienen los recursos compartidos de notificaciones.
