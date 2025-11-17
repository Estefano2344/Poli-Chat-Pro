# Poli-Chat-Pro (Mejorado)

Este proyecto implementa mejoras opcionales para sumar puntos:

- Login con autenticación (Firebase Authentication: Google o invitado)
- Tokens de autenticación (ID tokens de Firebase) verificados en el servidor
- Guardado de chats en base de datos (Firebase Firestore vía Firebase Admin)
- Validación de conexiones solo desde dominios permitidos
- Variables de entorno con `.env`

## Requisitos

- Node.js 18+
- Cuenta y proyecto en Firebase
  - Habilitar Authentication (Google y/o Anónimo)
  - Crear credenciales de servicio (JSON) para Firebase Admin (Firestore)

## Configuración

### Backend

1. Copia `backend/.env.example` a `backend/.env` y ajusta valores:

   - `PORT` (p.ej. 8080)
   - `ALLOWED_ORIGIN` (p.ej. `http://localhost:3000`)
   - `REQUIRE_AUTH` (`true` para exigir token válido)
   - Configura Firebase Admin:
     - Opción A: `GOOGLE_APPLICATION_CREDENTIALS` con ruta al JSON
     - Opción B: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (usa `\n` para saltos de línea)

2. Instala dependencias y ejecuta:

```bash
cd backend
npm install
npm run dev
```

El servidor WebSocket quedará en `ws://<tu_host>:PORT`.

### Frontend

1. Copia `frontend/public/firebase-config.sample.js` a `frontend/public/firebase-config.js` y pega tu configuración de cliente de Firebase.

2. Ejecuta el servidor estático:

```bash
cd frontend
npm install
node index.js
```

La app estará en `http://localhost:3000` (ajusta IP/host según tu entorno).

## Uso

- Inicia sesión con Google o entra como invitado.
- El cliente obtiene (cuando es posible) un ID token y lo envía en el evento `join` del WebSocket.
- El backend valida el `origin`, verifica tokens (si está configurado) y guarda mensajes en Firestore.
- Al conectarte recibirás un `history` con los últimos mensajes.

## Notas

- Si `REQUIRE_AUTH=false`, podrás conectarte sin token (útil para desarrollo rápido).
- Para múltiples orígenes permitidos, separa con comas en `ALLOWED_ORIGIN`.
- El front se conecta a `ws://<host>:8080`. Si cambias el puerto del backend, actualiza `script.js` o usa el mismo puerto.
