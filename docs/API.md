# API REST de Kalo · Documentación

Versión 2.1 (Etapa 2 · MongoDB Atlas) · Grupo 15

## 1. Introducción

La API de Kalo conecta la aplicación web (carpeta `public/`) con la base de datos MongoDB Atlas. La usan tres roles: el **cliente** (comprador), el **restaurante** y el **repartidor**. Con ella se puede ver el catálogo con calorías y macronutrientes, comprar, despachar un pedido, entregarlo con un PIN de 4 dígitos y evaluarlo.

- **URL base:** `http://localhost:3000` en desarrollo (en Railway, la URL del despliegue).
- **Prefijos:** `/api` para la autenticación y `/api/mongo` para los recursos.
- **Formato:** JSON en UTF-8. Las solicitudes con cuerpo deben enviar `Content-Type: application/json`.
- **Fechas:** ISO 8601 en UTC (`2026-11-16T15:20:00.000Z`). **Montos:** pesos chilenos (CLP) sin decimales; los planes nutricionales en USD.
- **Identificadores:** `ObjectId` de MongoDB (24 caracteres hexadecimales).

Todas las respuestas tienen el campo `exito`:

```json
{ "exito": true,  "mensaje": "...", "datos": [ ... ] }
{ "exito": false, "codigo": "PIN_INCORRECTO", "mensaje": "PIN de entrega incorrecto. Te quedan 4 intento(s)." }
```

Las consultas de lectura también devuelven `operacion` y `consultaMQL` (la consulta de MongoDB que se ejecutó), útiles para revisar la API con Postman o Thunder Client.

## 2. Autenticación y autorización

1. El usuario inicia sesión con `POST /api/login` (o crea su cuenta con `POST /api/registro`).
2. El servidor busca la cuenta **solo por correo** en `usuarios`, `restaurantes` y `repartidores`. Después compara la contraseña con `bcrypt.compare()`: las contraseñas se guardan como hash bcrypt de costo 10, nunca en texto plano.
3. Si coincide, responde con un **token JWT** firmado con `JWT_SECRET`. El token dura 8 horas (`JWT_EXPIRA`) y lleva el `id`, el `rol` y el `nombre`.
4. Las rutas protegidas exigen la cabecera:

```
Authorization: Bearer <token>
```

**Autorización por rol.** Cada ruta indica qué rol puede usarla. El servidor saca el usuario del token, no del cuerpo de la solicitud. Así, un cliente no puede comprar a nombre de otro y un restaurante no puede mover pedidos de otro local. Si falta el token o no es válido, responde **401**; si el rol no corresponde, **403**.

| Acceso | Rutas |
|---|---|
| Público | login, registro, `GET` platillos, platillos-fit, platillos-con-restaurante, planes |
| Con sesión (cualquier rol) | estadisticas, usuarios, usuarios-pedidos, `GET` pedidos (cada rol ve solo sus pedidos) |
| Cliente | `POST` pedidos, evaluar, `PUT` usuarios/biometrico, `DELETE` usuarios/:id (solo la propia cuenta) |
| Restaurante | `POST` platillos, `PUT` pedidos/estado, `GET` repartidores, `PUT` restaurantes/mi-local |
| Repartidor | `PUT` pedidos/aceptar, `POST` pedidos/validar-pin |

## 3. Endpoints

Leyenda: 🔓 público · 🔐 con token · (rol) rol exigido.

### 3.1 Autenticación

#### `POST /api/login` 🔓
Inicia sesión y entrega el token.

| Parámetro (cuerpo) | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| correo | string | sí | Correo de la cuenta (no distingue mayúsculas). |
| password | string | sí | Contraseña. |

Respuestas: **200** con `token`, `expira_en` y `usuario` (id, nombre, correo, teléfono, rol y los datos propios del rol, sin `password_hash`) · **400** DATOS_FALTANTES · **401** CREDENCIALES_INVALIDAS · **429** · **503**.

#### `POST /api/registro` 🔓
Crea una cuenta y deja la sesión iniciada.

| Parámetro (cuerpo) | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| rol | string | no | `cliente` (por defecto), `restaurante` o `repartidor`. |
| nombre, correo, password | string | sí | Contraseña de al menos 8 caracteres, con una mayúscula y un número. |
| peso, altura, edad, genero | number / string | cliente | Peso de 20 a 350 kg, altura de 1,00 a 2,50 m y edad de 12 a 110 años. Con ellos se calculan el IMC y la meta calórica. |
| especialidad, direccion | string | restaurante | Datos del local. |
| telefono, vehiculo | string | repartidor | `vehiculo`: Bicicleta, Motocicleta o Automóvil. |

Respuestas: **201** igual que el login · **400** DATOS_FALTANTES · **409** CORREO_REGISTRADO · **422** CORREO_INVALIDO, CLAVE_DEBIL, BIOMETRIA_INVALIDA, TELEFONO_INVALIDO o ROL_INVALIDO · **429**.

El `telefono` (obligatorio para repartidor, opcional para restaurante y cliente) debe tener exactamente 11 dígitos. Se permite un `+` al inicio y espacios o guiones (`+569 1234 5678`), y se guarda sin espacios ni guiones (`+56912345678`).

### 3.2 Catálogo

#### `GET /api/mongo/platillos` 🔓
Lista los platillos activos, ordenados por índice de transparencia y precio.

| Parámetro (query) | Tipo | Descripción |
|---|---|---|
| categoria | string | Desayuno, Almuerzo, Cena o Snack. |
| busqueda | string | Texto del nombre (`$regex`, sin distinguir mayúsculas; se escapan los caracteres especiales). |
| maxCalorias | entero > 0 | `calorias: { $lte }` |
| minProteina | número ≥ 0 | `macronutrientes.proteinas_g: { $gte }` |

Respuestas: **200** `{ total, datos: [platillo + restaurante_id con nombre, especialidad y dirección] }` · **400** PARAMETRO_INVALIDO.

#### `GET /api/mongo/platillos-fit?maxCalorias=500` 🔓
Platillos con `calorias ≤ maxCalorias` (500 por defecto), de menor a mayor. **200** · **400**.

#### `GET /api/mongo/platillos-con-restaurante` 🔓
JOIN con `$lookup` entre `platillos` y `restaurantes`. **200** `{ datos: [{ nombre, calorias, ..., restaurante: { nombre, especialidad, direccion, telefono } }] }`.

#### `GET /api/mongo/planes?precioMin=20` 🔓
Planes activos con `precio_mensual > precioMin`, de mayor a menor precio. **200** · **400**.

### 3.3 Consultas con sesión

| Método y ruta | Qué devuelve | Respuestas |
|---|---|---|
| `GET /api/mongo/estadisticas` 🔐 | `$group` por género: cantidad de clientes y promedios de peso, altura, IMC y meta calórica (sin nombres). | 200 · 401 |
| `GET /api/mongo/usuarios` 🔐 | Clientes activos con proyección: nombre, fecha de registro, género, IMC y meta calórica. No devuelve correo, teléfono ni contraseña. | 200 · 401 |
| `GET /api/mongo/usuarios-pedidos` 🔐 | LEFT JOIN (`$lookup` + `$size`): cada cliente con su cantidad de pedidos y gasto total, también los que tienen 0. | 200 · 401 |
| `GET /api/mongo/pedidos?estado=` 🔐 | Pedidos del usuario del token: el cliente ve los suyos, el restaurante los de su local y el repartidor los asignados a él más los que aún no tienen repartidor. Máximo 100, del más nuevo al más antiguo. El `pin_seguridad` solo aparece para el cliente dueño. | 200 · 400 · 401 |

### 3.4 Cliente

#### `POST /api/mongo/pedidos` 🔐 (cliente)
Crea el pedido en estado "En Preparación". El servidor calcula el precio de cada línea y el total con los precios guardados en `platillos`, más el envío de $1.490: no confía en los precios que manda el navegador. Cada línea guarda una copia (snapshot) del nombre y del precio del momento. **No se genera PIN todavía.**

```json
{ "items": [ { "platillo_id": "6620f6e3e13b8a1c90000001", "cantidad": 2 } ] }
```

Respuestas: **201** `{ mensaje, pedido }` · **400** CARRITO_VACIO o ID_INVALIDO · **403** · **404** PLATILLO_NO_ENCONTRADO · **422** VARIOS_RESTAURANTES, CANTIDAD_INVALIDA (1 a 20) o DEMASIADOS_ITEMS (más de 20 líneas).

#### `POST /api/mongo/pedidos/evaluar` 🔐 (cliente)
Cuerpo: `codigo_pedido`, `similitud_foto`, `gramaje_porcion`, `velocidad_prep` y `calificacion_general` (enteros de 1 a 5), y `comentario` opcional (máx. 500 caracteres).
Respuestas: **200** · **400** · **404** si el pedido no es del cliente · **409** PEDIDO_NO_ENTREGADO · **422** NOTA_INVALIDA.

#### `PUT /api/mongo/usuarios/biometrico` 🔐 (cliente)
Cuerpo (todo opcional): `peso`, `altura`, `edad`, `genero`, `nombre`, `telefono`. Recalcula el IMC. Si cambian el nombre o el teléfono, también actualiza la copia guardada en los pedidos del cliente con `updateMany`.
Respuestas: **200** `{ usuario, pedidos_actualizados }` · **404** · **422** BIOMETRIA_INVALIDA o TELEFONO_INVALIDO (el teléfono debe tener 11 dígitos).

#### `DELETE /api/mongo/usuarios/:usuario_id` 🔐 (cliente)
Elimina la cuenta y sus pedidos (derecho de supresión de datos de salud, Ley 21.719). Solo se puede borrar la propia cuenta.
Respuestas: **200** `{ pedidos_eliminados }` · **400** ID_INVALIDO · **403** · **404**.

### 3.5 Restaurante

#### `POST /api/mongo/platillos` 🔐 (restaurante)
Cuerpo: `nombre`, `precio` (> 0) y `calorias` (> 0) son obligatorios. Opcionales: `descripcion`, `categoria`, `imagen_url` (la foto subida desde el equipo como data URL `data:image/jpeg|png|webp;base64,…` de hasta 500 KB, o un enlace https; el frontend la reduce a 800 px antes de enviarla; responde 422 `IMAGEN_INVALIDA` o 413 `IMAGEN_MUY_GRANDE`), `proteinas`, `carbos`, `grasas`, `peso_porcion`, `alergenos`, `ingredientes_limpios` e `ingredientes` (hasta 30 elementos `{ nombre, cantidad_g, metodo_coccion }`). El restaurante sale del token. El servidor calcula el índice de transparencia: 50 % de base y hasta 100 % con los datos opcionales.
Respuestas: **201** `{ platillo }` · **400** · **403** · **422**.

#### `PUT /api/mongo/pedidos/estado` 🔐 (restaurante)
Cuerpo: `codigo_pedido`, `nuevo_estado` y `repartidor_id` (opcional, al despachar). Solo permite avanzar en orden: Pagado → En Preparación → En Camino, o pasar a Cancelado. **Al pasar a "En Camino" (despacho) se genera el PIN de 4 dígitos** con `crypto.randomInt`. Al restaurante no se le muestra.
Respuestas: **200** · **400** · **404** PEDIDO_NO_ENCONTRADO o REPARTIDOR_NO_ENCONTRADO · **409** CAMBIO_NO_PERMITIDO · **422** ESTADO_INVALIDO.

#### `GET /api/mongo/repartidores` 🔐 (restaurante)
Repartidores activos (nombre, vehículo, teléfono, estado y calificación) para elegir uno al despachar. **200**.

#### `PUT /api/mongo/restaurantes/mi-local` 🔐 (restaurante)
Cuerpo opcional: `nombre`, `direccion`, `telefono`, `especialidad`. **200** · **404** · **422** TELEFONO_INVALIDO (el teléfono debe tener 11 dígitos).

### 3.6 Repartidor

#### `PUT /api/mongo/pedidos/aceptar` 🔐 (repartidor)
Cuerpo: `codigo_pedido`. Asigna el pedido al repartidor y lo deja "En Camino". Si el pedido aún no tenía PIN, lo genera en ese momento.
Respuestas: **200** · **404** · **409** PEDIDO_TOMADO o CAMBIO_NO_PERMITIDO.

#### `POST /api/mongo/pedidos/validar-pin` 🔐 (repartidor)
Cuerpo: `codigo_pedido` y `pin_ingresado` (4 dígitos). Si el PIN coincide, el pedido queda "Entregado".
Respuestas: **200** · **400** · **401** PIN_INCORRECTO (indica los intentos que quedan) · **403** si el pedido es de otro repartidor · **404** · **409** YA_ENTREGADO o PEDIDO_NO_DESPACHADO · **422** PIN_FORMATO · **423** PIN_BLOQUEADO (5 intentos fallidos) · **429**.

## 4. Errores

| HTTP | Cuándo | Ejemplos de `codigo` |
|---|---|---|
| 400 | Faltan datos, el JSON está mal formado o un parámetro no es válido | DATOS_FALTANTES, JSON_INVALIDO, PARAMETRO_INVALIDO, ID_INVALIDO, CARRITO_VACIO |
| 401 | No hay sesión, el token venció o la credencial es incorrecta | NO_AUTENTICADO, TOKEN_INVALIDO, SESION_VENCIDA, CREDENCIALES_INVALIDAS, PIN_INCORRECTO |
| 403 | El rol no puede hacer esa acción, o el recurso es de otro usuario | SIN_PERMISO |
| 404 | No existe el recurso o la ruta | PEDIDO_NO_ENCONTRADO, PLATILLO_NO_ENCONTRADO, RUTA_NO_ENCONTRADA |
| 409 | Choca con el estado actual | CORREO_REGISTRADO, CAMBIO_NO_PERMITIDO, PEDIDO_TOMADO, YA_ENTREGADO |
| 413 | El cuerpo supera los 100 KB | CUERPO_DEMASIADO_GRANDE |
| 422 | Los datos tienen el formato correcto, pero no cumplen las reglas del negocio | CLAVE_DEBIL, BIOMETRIA_INVALIDA, TELEFONO_INVALIDO, VARIOS_RESTAURANTES, NOTA_INVALIDA |
| 423 | PIN bloqueado por intentos | PIN_BLOQUEADO |
| 429 | Se superó un límite de solicitudes | DEMASIADAS_SOLICITUDES |
| 500 | Error inesperado (el detalle queda en el registro del servidor, no se envía al cliente) | ERROR_INTERNO |
| 503 | MongoDB no está disponible | BD_NO_DISPONIBLE |

## 5. Ejemplos

**Iniciar sesión**

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"andrea@mail.com","password":"Kalo1234"}'
```

```json
{
  "exito": true,
  "mensaje": "¡Bienvenido(a) a Kalo, Andrea Gómez!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expira_en": "8h",
  "usuario": { "id": "6620f1a4e13b8a1c90000001", "nombre": "Andrea Gómez", "rol": "cliente", "perfil_biometrico": { "imc": 25.2, "meta_calorica_diaria": 1850 } }
}
```

**Crear un pedido (cliente)**

```bash
curl -X POST http://localhost:3000/api/mongo/pedidos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"platillo_id":"6620f6e3e13b8a1c90000001","cantidad":1}]}'
```

```json
{ "exito": true, "mensaje": "¡Pedido KALO-2026-677749 creado! Verás tu PIN de entrega cuando el pedido salga del local.",
  "pedido": { "codigo_pedido": "KALO-2026-677749", "estado": "En Preparación", "total": 9990, "pin_seguridad": null } }
```

**Despachar (restaurante) y validar el PIN (repartidor)**

```bash
curl -X PUT http://localhost:3000/api/mongo/pedidos/estado -H "Authorization: Bearer $TOKEN_LOCAL" \
  -H "Content-Type: application/json" -d '{"codigo_pedido":"KALO-2026-677749","nuevo_estado":"En Camino"}'

curl -X POST http://localhost:3000/api/mongo/pedidos/validar-pin -H "Authorization: Bearer $TOKEN_REPARTIDOR" \
  -H "Content-Type: application/json" -d '{"codigo_pedido":"KALO-2026-677749","pin_ingresado":"0000"}'
```

```json
{ "exito": false, "codigo": "PIN_INCORRECTO", "mensaje": "PIN de entrega incorrecto. Te quedan 4 intento(s)." }
```

**Ruta protegida sin token**

```json
HTTP 401  { "exito": false, "codigo": "NO_AUTENTICADO", "mensaje": "Debes iniciar sesión para usar esta función." }
```

El archivo `scripts/probarApi.js` (`npm run test:api`) ejecuta 46 pruebas de este tipo sobre el flujo completo.

## 6. Límites y cuotas

| Límite | Valor | Respuesta al superarlo |
|---|---|---|
| Solicitudes a `/api` por IP | 300 cada 15 minutos | 429 |
| Intentos fallidos de login o registro por IP | 10 cada 15 minutos | 429 |
| Intentos fallidos de PIN por IP | 20 cada 15 minutos | 429 |
| Intentos de PIN por pedido | 5 | 423 (bloqueado) |
| Tamaño del cuerpo JSON | 100 KB | 413 |
| Pedidos por consulta (`GET /pedidos`) | 100 | Se devuelven los 100 más recientes |
| Líneas por pedido / cantidad por línea | 20 / 1 a 20 | 422 |
| Ingredientes por platillo | 30 | 422 |
| Duración del token | 8 horas | 401 SESION_VENCIDA |

Cada respuesta trae las cabeceras `RateLimit-Policy` y `RateLimit` (límite, solicitudes restantes y segundos para el reinicio).

**Cuotas del plan de MongoDB Atlas (M0, gratuito):** 0,5 GB de almacenamiento, 500 conexiones, 100 operaciones de lectura y escritura por segundo y 10 GB de entrada y 10 GB de salida cada 7 días. Si se superan, Atlas no rechaza las operaciones: las hace más lentas. Con los datos actuales (pocos KB) estamos muy por debajo. Si el uso crece, el paso siguiente es un clúster Flex o dedicado, sin cambiar el código.

## 7. Consideraciones de seguridad

- **Contraseñas:** hash bcrypt de costo 10 (`bcryptjs`). El campo `password_hash` tiene `select: false`, así que ninguna consulta lo devuelve. El login responde lo mismo si el correo no existe o si la clave es incorrecta, para no revelar qué correos están registrados.
- **Secretos fuera del repositorio:** `MONGO_URI` y `JWT_SECRET` van en `.env`, que está en `.gitignore`. El archivo `env` con la cadena de conexión se retiró del repositorio y se cambió la clave del usuario de Atlas, porque la anterior quedó en el historial. El repositorio trae solo `.env.example`.
- **Sin base local en GitHub:** `nutridelivery.db` (SQLite, Etapa 1) se retiró del repositorio, y `*.db` está en `.gitignore`.
- **Autorización en el servidor:** el usuario sale del token, no del cuerpo. Cada rol ve solo sus pedidos, y el PIN solo lo ve el cliente dueño.
- **PIN de entrega:** se genera con `crypto.randomInt` cuando el pedido sale del local. Tiene 5 intentos por pedido y un límite por IP.
- **Validación de datos:** rangos de peso, altura, edad, notas, cantidades y estados. El texto del buscador se escapa antes de usarlo en `$regex`, y Mongoose descarta los campos que no están en el esquema.
- **Montos calculados en el servidor:** el total del pedido se calcula con los precios guardados.
- **Errores sin detalles internos:** un 500 no envía el mensaje técnico al navegador.
- **Datos de salud (Ley 21.719):** la consulta de clientes no expone correo ni teléfono, las estadísticas solo muestran promedios, y el cliente puede borrar su cuenta.
- **Pendiente:** en producción, HTTPS (Railway lo entrega), restringir CORS al dominio propio (`CORS_ORIGEN`) y restringir el acceso de red de Atlas a la IP del servidor en vez de 0.0.0.0/0.
