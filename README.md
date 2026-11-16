# Kalo — Plataforma Web de Delivery Nutricional Transparente

> **Asignatura:** ICI324 Desarrollo Web y Bases de Datos — Universidad de Valparaíso  
> **Integrantes:** Ariadna Espejo — Benjamín Figueroa  
---

## 📌 Resumen del Proyecto
**Kalo** es una plataforma web que revoluciona el delivery de comida fusionando **HealthTech + FoodTech**. Resuelve la desinformación calórica, la desconfianza hacia las *Dark Kitchens* y los fraudes en la entrega mediante tres pilares:
1. **Transparencia Nutricional:** Cálculo automático de IMC, metas calóricas diarias y desglose transparente de ingredientes y métodos de cocción.
2. **Auditoría de Dark Kitchens:** Sello e Índice de Transparencia (1-100%) respaldado por fotos verificadas de instalaciones y evaluaciones de la comunidad.
3. **Logística Segura con PIN:** Código ambix de 4 dígitos generado al cliente que el repartidor debe validar en su teclado numérico para completar la entrega.

---

## 🛠️ Arquitectura Tecnológica
* **Frontend:** HTML5, CSS3 y JavaScript sin frameworks (SPA en `public/`).
* **Backend:** Node.js + Express 5 (API REST modular: rutas → controladores → modelos).
* **Base de datos:** MongoDB Atlas con Mongoose (colecciones `usuarios`, `planes_nutricionales`, `restaurantes`, `platillos`, `repartidores` y `pedidos`).
* **Seguridad:** contraseñas con hash bcrypt, sesión con token JWT y permisos por rol, límites de solicitudes (express-rate-limit).
* La base SQLite de la Etapa 1 se retiró del proyecto; su diseño queda documentado en el informe.

📄 Documentación de la API: [docs/API.md](docs/API.md)

---

## 🚀 Puesta en Marcha Local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo .env a partir del ejemplo y completar MONGO_URI y JWT_SECRET
cp .env.example .env

# 3. Cargar los datos de prueba (BORRA y vuelve a crear las colecciones)
npm run seed

# 4. Iniciar el servidor → http://localhost:3000
npm start

# 5. (Opcional, con el servidor corriendo) probar la API: 46 pruebas
npm run test:api
```

Cuentas de prueba (contraseña `Kalo1234`): `andrea@mail.com` (cliente), `contacto@greenbowl.cl` (restaurante) y `carlos.reparto@kalo.cl` (repartidor).

Si en Atlas quedaron cuentas creadas antes de esta versión con la contraseña en texto plano, `npm run migrar-claves` las convierte a hash bcrypt.

> ⚠️ Nunca subas el archivo `.env`: contiene la clave de MongoDB Atlas.
