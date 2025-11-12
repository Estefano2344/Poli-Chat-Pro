const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const users = new Map(); // Map para guardar usuarios activos
// const path = require('path'); // Ya no necesitas 'path'

const app = express();
// 1. CAMBIA EL PUERTO
const PORT = process.env.PORT || 8080; 

// Crear servidor HTTP usando la app de Express
const server = http.createServer(app);

// Crear servidor WebSocket (wss) y adjuntarlo al servidor HTTP
const wss = new WebSocketServer({ server });

// Lógica de conexión del WebSocket
wss.on('connection', (ws) => {
    console.log('Cliente conectado');
    ws.username = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // Si el mensaje es de tipo 'join'
            if (data.type === 'join' && data.username) {
                ws.username = data.username;
                users.set(ws, data.username);
                console.log(`${data.username} se unió al chat`);
                broadcastUsers();
                return;
            }

            // Si es un mensaje normal
            if (data.type === 'message') {
                const now = new Date();
                const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const msgToSend = JSON.stringify({
                    type: 'message',
                    username: ws.username || 'Anonimo',
                    text: data.text,
                    timestamp
                });

                wss.clients.forEach((client) => {
                    if (client.readyState === ws.OPEN) {
                        client.send(msgToSend);
                    }
                });
            }
        } catch (e) {
            console.error('Error al procesar mensaje:', e);
        }
    });

    ws.on('close', () => {
        console.log(`${ws.username || 'Usuario'} desconectado`);
        users.delete(ws);
        broadcastUsers();
    });

    ws.on('error', (err) => {
        console.error('Error WebSocket:', err);
    });
});

// Función para enviar la lista de usuarios conectados
function broadcastUsers() {
    const userList = Array.from(users.values()).map((u) => ({
        username: u,
        online: true
    }));
    const msg = JSON.stringify({ type: 'users', users: userList });
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(msg);
        }
    });
}

// Iniciar el servidor
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor WebSocket accesible en red local: ws://<TU_IP_LOCAL>:${PORT}`);
});