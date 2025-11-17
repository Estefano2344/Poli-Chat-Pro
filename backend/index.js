const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Firebase Admin (opcional si se configuran credenciales)
let admin = null;
let db = null;
try {
  // Cargar dinámicamente para evitar fallo si no se usa
  // eslint-disable-next-line global-require
  admin = require("firebase-admin");
  const hasAppDefault = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasEnvCreds = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );

  if (hasAppDefault) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else if (hasEnvCreds) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }

  if (admin?.apps?.length) {
    db = admin.firestore();
    console.log("Firebase Admin inicializado. Firestore activo.");
  } else {
    console.warn(
      "Firebase Admin NO configurado. Token y Firestore deshabilitados."
    );
  }
} catch (e) {
  console.warn(
    "firebase-admin no instalado o no configurado. Funciones avanzadas deshabilitadas."
  );
}

const users = new Map();
const app = express();

const PORT = process.env.PORT || 8080;
const REQUIRE_AUTH =
  (process.env.REQUIRE_AUTH || "false").toLowerCase() === "true";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Enviar historial reciente a un cliente
async function sendRecentHistory(ws, limit = 30) {
  if (!db) return;
  try {
    const snap = await db
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const items = [];
    snap.forEach((doc) => {
      const d = doc.data();
      items.push({
        username: d.username || "Anonimo",
        text: d.text || "",
        timestamp: d.createdAt?.toDate?.()
          ? d.createdAt
              .toDate()
              .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
      });
    });
    items.reverse();
    ws.send(JSON.stringify({ type: "history", items }));
  } catch (err) {
    console.error("Error leyendo historial:", err.message);
  }
}

// Validar origen permitido
function isOriginAllowed(origin) {
  if (!ALLOWED_ORIGINS.length) return true; // si no se configuró, permitir
  return ALLOWED_ORIGINS.includes(origin);
}

wss.on("connection", (ws, req) => {
  const origin = req.headers.origin;
  if (!isOriginAllowed(origin)) {
    console.warn("Conexión rechazada por ORIGIN no permitido:", origin);
    try {
      ws.close(1008, "Origin not allowed");
    } catch (_) {}
    return;
  }

  console.log("Cliente conectado");
  ws.username = null;
  ws.user = null; // datos del usuario autenticado

  // Enviar historial si Firestore está activo
  sendRecentHistory(ws).catch(() => {});

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      // Paso de autenticación (join)
      if (data.type === "join") {
        const providedName = (data.username || "").toString().trim();
        const idToken = data.idToken || null;

        if (REQUIRE_AUTH && !idToken) {
          console.warn("Join sin token y REQUIRE_AUTH=true: cerrando");
          try {
            ws.close(4001, "Auth required");
          } catch (_) {}
          return;
        }

        // Verificar token si está disponible firebase-admin y se proporcionó token
        if (idToken && admin?.apps?.length) {
          try {
            const decoded = await admin.auth().verifyIdToken(idToken);
            ws.user = {
              uid: decoded.uid,
              email: decoded.email || null,
              name: providedName || decoded.name || decoded.email || "Anonimo",
            };
          } catch (err) {
            console.warn("Token inválido:", err.message);
            if (REQUIRE_AUTH) {
              try {
                ws.close(4003, "Invalid token");
              } catch (_) {}
              return;
            }
          }
        }

        ws.username = ws.user?.name || providedName || "Anonimo";
        users.set(ws, ws.username);
        console.log(`${ws.username} se unió al chat`);
        broadcastUsers();
        return;
      }

      // Mensajes normales
      if (data.type === "message") {
        if (REQUIRE_AUTH && !ws.user) {
          console.warn("Mensaje rechazado: no autenticado");
          return;
        }

        const now = new Date();
        const timestamp = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const sender = ws.username || "Anonimo";

        // Persistir en Firestore si disponible
        if (db) {
          try {
            await db.collection("messages").add({
              uid: ws.user?.uid || null,
              username: sender,
              text: data.text?.toString() || "",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } catch (err) {
            console.error("Error guardando mensaje en Firestore:", err.message);
          }
        }

        const msgToSend = JSON.stringify({
          type: "message",
          username: sender,
          text: data.text,
          timestamp,
        });

        wss.clients.forEach((client) => {
          if (client.readyState === ws.OPEN) {
            client.send(msgToSend);
          }
        });
      }
    } catch (e) {
      console.error("Error al procesar mensaje:", e);
    }
  });

  ws.on("close", () => {
    console.log(`${ws.username || "Usuario"} desconectado`);
    users.delete(ws);
    broadcastUsers();
  });

  ws.on("error", (err) => {
    console.error("Error WebSocket:", err);
  });
});

function broadcastUsers() {
  const userList = Array.from(users.values()).map((u) => ({
    username: u,
    online: true,
  }));
  const msg = JSON.stringify({ type: "users", users: userList });
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(msg);
    }
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor WebSocket en puerto ${PORT}`);
});
