const express = require('express');
const app = express();
const PORT = 3000;
// Servir archivos estáticos desde la carpeta "public"
app.use(express.static('public'));
// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend disponible en http://172.31.103.16:${PORT}`);
});
