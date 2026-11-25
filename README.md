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
* **Frontend:** React 18 + React Router + Bootstrap 5 (react-bootstrap y Bootstrap Icons), compilado con Vite (carpeta `frontend/`).
* **Backend:** Node.js + Express 5 (API REST modular: rutas → controladores → modelos).
* **Base de datos:** MongoDB Atlas con Mongoose (colecciones `usuarios`, `planes_nutricionales`, `restaurantes`, `platillos`, `repartidores`, `pedidos`, `fotos_cocina` y `notificaciones`).
* **Seguridad:** contraseñas con hash bcrypt, datos de salud cifrados (AES-256-GCM), sesión con token JWT y permisos por rol, límites de solicitudes, Helmet y protección contra inyección NoSQL.
* La base SQLite de la Etapa 1 se retiró del proyecto; su diseño queda documentado en el informe.

📄 Documentación de la API: [docs/API.md](docs/API.md)

---

## 🚀 Puesta en Marcha Local

```bash
# 1. Instalar dependencias (también instala las del frontend)
npm install

# 2. Crear el archivo .env a partir del ejemplo y completar MONGO_URI y JWT_SECRET
cp .env.example .env

# 3. Cargar los datos de prueba (BORRA y vuelve a crear las colecciones)
npm run seed

# 4. Compilar el frontend React (queda en frontend/dist)
npm run build

# 5. Iniciar el servidor → http://localhost:3000
npm start

# (Opcional) probar la API con el servidor corriendo: 75 pruebas
npm run test:api
```

**Para programar el frontend con recarga automática**, usa dos terminales: `npm run dev` (API en el puerto 3000) y `npm run dev:front` (app en http://localhost:5173).

**Railway:** Build `npm install && npm run build`, Start `npm start`, variables `MONGO_URI` y `JWT_SECRET`.

### Estructura del frontend

```
frontend/src/
├── api/cliente.js        → todas las llamadas a la API (token JWT y errores)
├── contexto/             → sesión, carrito y avisos (React Context)
├── componentes/          → layouts por rol (cliente, restaurante, repartidor) y piezas comunes
└── paginas/              → pantallas: cliente/, restaurante/, repartidor/
```

Cuentas de prueba (contraseña `Kalo1234`): `andrea@mail.com` (cliente), `contacto@greenbowl.cl` (restaurante) y `carlos.reparto@kalo.cl` (repartidor).

Si en Atlas quedaron cuentas creadas antes de esta versión con la contraseña en texto plano, `npm run migrar-claves` las convierte a hash bcrypt.

> ⚠️ Nunca subas el archivo `.env`: contiene la clave de MongoDB Atlas.

### Etapa 3: requisitos implementados

| Requisito | Dónde verlo en la app |
|---|---|
| RF-03 Meta calórica y consumo del día | Explorar (barra "Has consumido X de Y kcal hoy") y Mi perfil |
| RF-04 Filtros nutricionales | Explorar → "Filtros a tu medida" (calorías, presupuesto, proteína, carbohidratos, transparencia) |
| RF-07 Fotos de la cocina | Restaurante → Mi local (subir) · Cliente → Locales → perfil del local (galería) |
| RF-08 Cálculo nutricional | Restaurante → Crear platillo → "Calcular calorías y macros con los ingredientes" |
| RF-09 a RF-11, RF-14 Índice y ranking | Insignias en cada platillo, Locales ordenados por índice, se recalcula con cada evaluación |
| RF-12, RF-20, RF-23 Avisos | Campana en los tres roles; el repartidor tiene "Estoy a 5 minutos" |
| RF-21 Planes | Mi perfil → Contratar / Cancelar plan (con pago) |
| RNF-07 Pago | Carrito → "Ir a pagar" (pasarela en modo de prueba, tarjeta `4111 1111 1111 1111`) |
| RNF-08 Accesibilidad | Botón ♿ en la barra: alto contraste y texto grande |

Antes de usar Atlas con esta versión, agrega `DATOS_SALUD_CLAVE` al `.env` (ver `.env.example`) y ejecuta **una** de estas opciones:
- `npm run seed` → borra y vuelve a cargar los datos de prueba (ya cifrados), o
- `npm run cifrar-salud` → cifra los perfiles que ya existen sin borrar nada.
