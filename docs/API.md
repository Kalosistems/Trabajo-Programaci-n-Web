# API REST de Kalo · Documentación

Versión 3.0 (Entrega final · MongoDB Atlas + PostgreSQL) · Grupo 15

## 1. Introducción

La API de Kalo conecta la aplicación web (carpeta `frontend/`, React) con **dos bases de datos al mismo tiempo**: **PostgreSQL** (relacional: cuentas, sesiones, pagos y accesos) y **MongoDB Atlas** (no relacional: perfiles, catálogo, pedidos, fotos y avisos). Además usa un servicio en la nube, **USDA FoodData Central**, para el cálculo nutricional. La usan tres roles: el **cliente** (comprador), el **restaurante** y el **repartidor**. Con ella se puede ver el catálogo con calorías y macronutrientes, comprar, despachar un pedido, entregarlo con un PIN de 4 dígitos y evaluarlo.

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
2. El servidor busca la cuenta **solo por correo** en la tabla `cuentas` de **PostgreSQL** (consulta parametrizada `WHERE correo = $1`) y compara la contraseña con `bcrypt.compare()`. Las contraseñas se guardan como hash bcrypt de costo 10, nunca en texto plano, y ya no están en MongoDB.
3. Si coincide, crea una fila en la tabla `sesiones` (con el identificador `jti` del token) y firma un **token JWT** con `JWT_SECRET`, que dura 8 horas.
4. **El token no se entrega en el JSON**: va en una cookie `kalo_sesion` con las banderas `HttpOnly` (el JavaScript del navegador no puede leerla), `SameSite=Strict` (no viaja desde otros sitios), `Secure` en HTTPS y `Path=/api`. El navegador la envía solo en cada solicitud.
5. En cada ruta protegida el servidor verifica la firma del token **y** que su sesión siga vigente en PostgreSQL (no revocada, no vencida, cuenta activa). `POST /api/logout` revoca la sesión al instante.
6. Cada inicio de sesión, exitoso o fallido, queda en la tabla `accesos`.

> Para Postman o Thunder Client: después del login, el cliente HTTP guarda la cookie y la envía sola en las siguientes solicitudes.

**Autorización por rol.** Cada ruta indica qué rol puede usarla. El servidor saca el usuario del token, no del cuerpo de la solicitud. Así, un cliente no puede comprar a nombre de otro y un restaurante no puede mover pedidos de otro local. Si falta la cookie, el token no es válido o la sesión fue cerrada, responde **401**; si el rol no corresponde, **403**.

| Acceso | Rutas |
|---|---|
| Público | login, registro, `GET` sesion, platillos, platillos-fit, platillos-con-restaurante, planes, restaurantes, nutricion |
| Con sesión (cualquier rol) | `POST` logout, notificaciones |
| Con sesión (cualquier rol) | estadisticas, usuarios, usuarios-pedidos, `GET` pedidos (cada rol ve solo sus pedidos) |
| Cliente | `POST` pedidos, evaluar, `PUT` usuarios/biometrico, `DELETE` usuarios/:id (solo la propia cuenta) |
| Restaurante | `POST` platillos, `PUT` platillos/:id/estado y /stock, `PUT` pedidos/estado, `GET` repartidores, mi-local y fotos de la cocina |
| Repartidor | `PUT` pedidos/aceptar, `POST` pedidos/validar-pin |

## 3. Endpoints

Leyenda: 🔓 público · 🔐 con sesión (cookie) · (rol) rol exigido.

### 3.1 Autenticación

#### `POST /api/login` 🔓
Inicia sesión: verifica la cuenta en PostgreSQL y deja el token en la cookie httpOnly `kalo_sesion`.

| Parámetro (cuerpo) | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| correo | string | sí | Correo de la cuenta (no distingue mayúsculas). |
| password | string | sí | Contraseña. |

Respuestas: **200** con `expira_en` y `usuario` (id, nombre, correo, teléfono, rol y los datos propios del rol), más la cabecera `Set-Cookie`. El cuerpo **no** trae el token ni la contraseña · **400** DATOS_FALTANTES · **401** CREDENCIALES_INVALIDAS · **429** · **503**.

#### `POST /api/logout` 🔐
Revoca la sesión en PostgreSQL (`sesiones.revocada = TRUE`) y borra la cookie. **200** · **401**.

#### `GET /api/sesion` 🔓
Dice quién está conectado según la cookie: `{ usuario }`, o `{ usuario: null }` si no hay cookie. El frontend la consulta al abrir la app. **200** · **401** SESION_CERRADA o SESION_VENCIDA.

#### `POST /api/registro` 🔓
Crea una cuenta y deja la sesión iniciada.

| Parámetro (cuerpo) | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| rol | string | no | `cliente` (por defecto), `restaurante` o `repartidor`. |
| nombre, correo, password | string | sí | Contraseña de al menos 8 caracteres, con una mayúscula y un número. |
| peso, altura, edad, genero | number / string | cliente | Peso de 20 a 350 kg, altura de 1,00 a 2,50 m y edad de 12 a 110 años. Con ellos se calculan el IMC y la meta calórica. |
| especialidad, direccion | string | restaurante | Datos del local. |
| telefono, vehiculo | string | repartidor | `vehiculo`: Bicicleta, Motocicleta o Automóvil. |

Crea el perfil en MongoDB y la cuenta (correo, rol y hash) en PostgreSQL; si PostgreSQL falla, se deshace el perfil.
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

#### `GET /api/mongo/restaurantes` 🔓 (RF-11)
Ranking de locales activos por `indice_transparencia` (y luego por calificación), con `total_platillos` y `total_fotos_cocina`. Nunca devuelve correo ni hash. **200**.

#### `GET /api/mongo/restaurantes/:id` 🔓 (RF-07)
Perfil público del local: `{ restaurante, platillos, fotos, evaluaciones }`. Las fotos de la cocina traen `url` (no la imagen) y las evaluaciones solo el primer nombre del cliente. **200** · **400** · **404**.

#### `GET /api/mongo/restaurantes/fotos/:id` 🔓
Devuelve la imagen de una foto de la cocina (`image/jpeg`, caché de 1 día) o redirige si es un enlace https. **200** · **302** · **404**.

#### `GET /api/mongo/nutricion/alimentos` 🔓 (RF-08)
Tabla de referencia (≈75 alimentos, valores por 100 g basados en USDA FoodData Central) para el autocompletado. **200**.

#### `POST /api/mongo/nutricion/calcular` 🔓 (RF-08)
Cuerpo: `ingredientes: [{ nombre, cantidad_g, unidad: "g"|"ml", metodo_coccion }]` (máx. 30). Cada alimento reconocido se consulta en la API de **USDA FoodData Central** (base SR Legacy, por 100 g); el resultado queda en la tabla `alimentos_usda` de PostgreSQL. Si USDA no responde o trae un alimento distinto (más de 40 % de diferencia con la referencia), se usa la tabla de Kalo. Devuelve `calorias`, `proteinas`, `carbos`, `grasas`, `fuente`, los ingredientes `reconocidos` (con su `fdc_id` de USDA) y `no_reconocidos`, y el `indice_transparencia` que tendría el platillo con su `detalle_indice`. Los ingredientes fritos suman 5 g de aceite por cada 100 g.
Respuestas: **200** · **400** DATOS_FALTANTES · **422** SIN_DATOS_NUTRICIONALES o DEMASIADOS_INGREDIENTES.

#### `GET /api/salud` 🔓 (RNF-04)
Estado del servicio para monitores de disponibilidad: `{ mongodb, postgresql, usda, activo_desde_s }`. **200** · **503** si alguna de las dos bases no responde. No cuenta para el límite de solicitudes.

### 3.3 Consultas con sesión

| Método y ruta | Qué devuelve | Respuestas |
|---|---|---|
| `GET /api/mongo/estadisticas` 🔐 | `$group` por género (cantidad de clientes) y promedios de peso, altura, IMC y meta calórica calculados en el servidor, porque esos datos están cifrados en la base (sin nombres). | 200 · 401 |
| `GET /api/mongo/notificaciones` 🔐 | Últimos 30 avisos del usuario del token y `no_leidas` (RF-12, RF-20, RF-23). Nunca incluyen el PIN ni datos de salud. Se borran solos a los 30 días. | 200 · 401 |
| `PUT /api/mongo/notificaciones/leidas` 🔐 | Marca como leídos los avisos de `ids` (o todos si no se envía). | 200 · 400 · 401 |
| `GET /api/mongo/usuarios` 🔐 | Clientes activos con proyección: nombre, fecha de registro, género, IMC y meta calórica. No devuelve correo, teléfono ni contraseña. | 200 · 401 |
| `GET /api/mongo/usuarios-pedidos` 🔐 | LEFT JOIN (`$lookup` + `$size`): cada cliente con su cantidad de pedidos y gasto total, también los que tienen 0. | 200 · 401 |
| `GET /api/mongo/pedidos?estado=` 🔐 | Pedidos del usuario del token: el cliente ve los suyos, el restaurante los de su local y el repartidor los asignados a él más los que aún no tienen repartidor. Máximo 100, del más nuevo al más antiguo. El `pin_seguridad` solo aparece para el cliente dueño. | 200 · 400 · 401 |

### 3.4 Cliente

#### `POST /api/mongo/pedidos` 🔐 (cliente)
Crea el pedido en estado **"Pagado"** y avisa al restaurante (RF-20). El servidor calcula el precio de cada línea y el total con los precios guardados en `platillos`, más el envío de $1.490: no confía en los precios que manda el navegador. Cada línea guarda una copia (snapshot) del nombre, del precio y de las calorías del momento; el pedido guarda `total_calorias` (RF-03). **No se genera PIN todavía.**

El pago lo autoriza antes la pasarela (RNF-07): el navegador manda los datos de la tarjeta a la pasarela y a Kalo solo llega su comprobante. Si el cuerpo trae algo parecido a un número de tarjeta, se rechaza.

```json
{ "items": [ { "platillo_id": "6620f6e3e13b8a1c90000001", "cantidad": 2 } ],
  "pago": { "referencia": "pay_sim_4k2j9x0a1b2c3d4e5f6g", "marca": "Visa", "ultimos4": "1111", "metodo": "credito" } }
```

Además: descuenta las porciones del stock de forma atómica y anota el pago en la tabla `pagos` de PostgreSQL, cuya `referencia` es UNIQUE.
Respuestas: **201** `{ mensaje, pedido }` · **400** CARRITO_VACIO o ID_INVALIDO · **402** PAGO_REQUERIDO · **409** SIN_STOCK o PAGO_YA_USADO · **403** · **404** PLATILLO_NO_ENCONTRADO · **422** VARIOS_RESTAURANTES, CANTIDAD_INVALIDA (1 a 20), DEMASIADOS_ITEMS, PAGO_INVALIDO o DATOS_TARJETA_NO_PERMITIDOS.

#### `GET /api/mongo/usuarios/consumo` 🔐 (cliente) · RF-03
Calorías del día (hora de Chile): `{ meta_calorica_diaria, consumidas_hoy, en_camino_kcal, restantes, porcentaje, pedidos_entregados_hoy }`. Se cuentan los pedidos entregados hoy; se actualiza apenas el repartidor valida el PIN. **200** · **404**.

#### `POST /api/mongo/planes/contratar` 🔐 (cliente) · RF-21
Cuerpo: `plan_id` y `pago` (igual que en pedidos). Crea un pedido de `tipo: "plan"` con la copia del plan en `plan_adquirido` (relación PLAN_NUTRICIONAL–PEDIDO del modelo E-R), guarda `plan_activo` en la cuenta y la meta diaria pasa a ser la del plan.
Respuestas: **201** `{ pedido, usuario }` · **400** · **402** · **404** PLAN_NO_ENCONTRADO · **409** PLAN_YA_CONTRATADO · **422**.

#### `DELETE /api/mongo/planes/contrato` 🔐 (cliente) · RF-21
Cancela el plan activo; la meta vuelve a la recomendada por la fórmula. **200** `{ usuario }` · **409** SIN_PLAN.

#### `POST /api/mongo/pedidos/evaluar` 🔐 (cliente)
Cuerpo: `codigo_pedido`, `similitud_foto`, `gramaje_porcion`, `velocidad_prep` y `calificacion_general` (enteros de 1 a 5), y `comentario` opcional (máx. 500 caracteres).
Guarda la evaluación, recalcula el Índice de Transparencia y la calificación del local (RF-14) y le avisa al restaurante.
Respuestas: **200** `{ pedido, indice_restaurante }` · **400** · **404** si el pedido no es del cliente · **409** PEDIDO_NO_ENTREGADO o YA_EVALUADO · **422** NOTA_INVALIDA.

#### `PUT /api/mongo/usuarios/biometrico` 🔐 (cliente)
Cuerpo (todo opcional): `peso`, `altura`, `edad`, `genero`, `nivel_actividad` (sedentario, ligero, moderado, intenso), `objetivo` (bajar, mantener, subir), `nombre`, `telefono`. Recalcula el IMC y la meta calórica con Mifflin-St Jeor (si hay un plan activo, la meta sigue siendo la del plan). Los datos de salud se guardan cifrados con AES-256-GCM. Si cambian el nombre o el teléfono, también actualiza la copia guardada en los pedidos del cliente con `updateMany`.
Respuestas: **200** `{ usuario, pedidos_actualizados }` · **404** · **422** BIOMETRIA_INVALIDA o TELEFONO_INVALIDO (el teléfono debe tener 11 dígitos).

#### `DELETE /api/mongo/usuarios/:usuario_id` 🔐 (cliente)
Elimina la cuenta, sus pedidos y sus avisos (derecho de supresión de datos de salud, Ley 21.719). Solo se puede borrar la propia cuenta.
Respuestas: **200** `{ pedidos_eliminados }` · **400** ID_INVALIDO · **403** · **404**.

### 3.5 Restaurante

#### `POST /api/mongo/platillos` 🔐 (restaurante)
Cuerpo: `nombre`, `precio` (> 0) y `calorias` (> 0) son obligatorios. Opcionales: `descripcion`, `categoria`, `imagen_url` (la foto subida desde el equipo como data URL `data:image/jpeg|png|webp;base64,…` de hasta 500 KB, o un enlace https; el frontend la reduce a 800 px antes de enviarla; responde 422 `IMAGEN_INVALIDA` o 413 `IMAGEN_MUY_GRANDE`), `proteinas`, `carbos`, `grasas`, `peso_porcion`, `alergenos`, `ingredientes_limpios` e `ingredientes` (hasta 30 elementos `{ nombre, cantidad_g, unidad: "g"|"ml", metodo_coccion }`). El restaurante sale del token. Si se envía `calcular_nutricion: true` o no se envían las calorías, Kalo las calcula con los ingredientes (RF-08) y marca `nutricion_calculada`.
**Índice de Transparencia (RF-09, 1 a 100):** nombre, precio y calorías 20 · macros informados 15 (5 c/u) · porción 10 · alérgenos 5 · descripción 5 · foto propia 5 · lista de ingredientes 10 · gramos de cada ingrediente 20 · método de cocción de cada ingrediente 10. Si se informan los tres macros y las calorías no calzan con 4·P + 4·C + 9·G (±25 %), resta 10. Después se recalcula el índice del local.
Respuestas: **201** `{ platillo, indice_restaurante }` · **400** · **403** · **413** · **422**.

#### `GET /api/mongo/platillos/mios` 🔐 (restaurante)
Todos los platillos del local, incluidos los retirados del menú. **200**.

#### `PUT /api/mongo/platillos/:id/stock` 🔐 (restaurante)
Cuerpo: `stock` (porciones disponibles, 0 a 9.999). En 0 el platillo aparece "Agotado". **200** · **400** · **404** · **422** STOCK_INVALIDO.

#### `PUT /api/mongo/platillos/:id/estado` 🔐 (restaurante)
Cuerpo: `activo` (true/false). Publica o retira el platillo del menú y recalcula el índice del local. **200** · **400** · **404**.

#### `GET /api/mongo/restaurantes/mi-local` 🔐 (restaurante)
Datos del local, fotos de la cocina, evaluaciones y `max_fotos` (12). **200**.

#### `POST /api/mongo/restaurantes/fotos` 🔐 (restaurante) · RF-07
Cuerpo: `imagen` (data URL JPEG/PNG/WebP ya comprimida en el navegador, máx. 500 KB, o enlace https), `descripcion` (máx. 120) y `area` (Cocina, Preparación, Almacenamiento, Lavado u Otra). Se guarda en la colección `fotos_cocina`; la primera queda como `foto_cocina` del local.
Respuestas: **201** `{ foto }` · **400** · **413** IMAGEN_MUY_GRANDE · **422** IMAGEN_INVALIDA o LIMITE_FOTOS.

#### `DELETE /api/mongo/restaurantes/fotos/:id` 🔐 (restaurante)
Elimina una foto propia. **200** · **400** · **404**.

#### `PUT /api/mongo/pedidos/estado` 🔐 (restaurante)
Cuerpo: `codigo_pedido`, `nuevo_estado` y `repartidor_id` (opcional, al despachar). Solo permite avanzar en orden: Pagado → En Preparación (aceptar) → En Camino (despachar), o pasar a Cancelado (rechazar: el pago queda "Reembolsado"). **Al pasar a "En Camino" se genera el PIN de 4 dígitos** con `crypto.randomInt`, distinto de los PIN de otros pedidos en camino. Al restaurante no se le muestra. Cada cambio le avisa al cliente (sin el PIN) y, al despachar, al repartidor asignado.
Respuestas: **200** · **400** · **404** PEDIDO_NO_ENCONTRADO o REPARTIDOR_NO_ENCONTRADO · **409** CAMBIO_NO_PERMITIDO · **422** ESTADO_INVALIDO.

#### `GET /api/mongo/repartidores` 🔐 (restaurante)
Repartidores activos que no están desconectados (los disponibles primero) para elegir uno al despachar. **200**.

#### `PUT /api/mongo/restaurantes/mi-local` 🔐 (restaurante)
Cuerpo opcional: `nombre`, `direccion`, `telefono`, `especialidad`. **200** · **404** · **422** TELEFONO_INVALIDO (el teléfono debe tener 11 dígitos).

### 3.6 Repartidor

#### `PUT /api/mongo/pedidos/aceptar` 🔐 (repartidor)
Cuerpo: `codigo_pedido`. Asigna el pedido al repartidor y lo deja "En Camino". Si el pedido aún no tenía PIN, lo genera en ese momento.
Respuestas: **200** · **404** · **409** PEDIDO_TOMADO o CAMBIO_NO_PERMITIDO.

#### `PUT /api/mongo/pedidos/cerca` 🔐 (repartidor) · RF-23
Cuerpo: `codigo_pedido`. Avisa al cliente que el repartidor llega en 5 minutos o menos (una sola vez por pedido). **200** · **404** · **409**.

#### `PUT /api/mongo/repartidores/disponibilidad` 🔐 (repartidor)
Cuerpo: `estado` ("Disponible" o "Desconectado"). **200** · **422** ESTADO_INVALIDO.

#### `POST /api/mongo/pedidos/validar-pin` 🔐 (repartidor)
Cuerpo: `codigo_pedido` y `pin_ingresado` (4 dígitos). Si el PIN coincide, el pedido queda "Entregado", se suman sus calorías al consumo del día del cliente y se le pide evaluarlo (RF-12, RF-18). Al 5.º intento fallido se avisa al restaurante.
Respuestas: **200** · **400** · **401** PIN_INCORRECTO (indica los intentos que quedan) · **403** si el pedido es de otro repartidor · **404** · **409** YA_ENTREGADO o PEDIDO_NO_DESPACHADO · **422** PIN_FORMATO · **423** PIN_BLOQUEADO (5 intentos fallidos) · **429**.

## 4. Errores

| HTTP | Cuándo | Ejemplos de `codigo` |
|---|---|---|
| 400 | Faltan datos, el JSON está mal formado, un parámetro no es válido o trae claves "$…" (inyección NoSQL) | DATOS_FALTANTES, JSON_INVALIDO, PARAMETRO_INVALIDO, ID_INVALIDO, CARRITO_VACIO, DATOS_NO_PERMITIDOS |
| 402 | Falta la confirmación de pago de la pasarela | PAGO_REQUERIDO |
| 401 | No hay sesión, el token venció, la sesión fue cerrada o la credencial es incorrecta | NO_AUTENTICADO, TOKEN_INVALIDO, SESION_VENCIDA, SESION_CERRADA, CREDENCIALES_INVALIDAS, PIN_INCORRECTO |
| 403 | El rol no puede hacer esa acción, o el recurso es de otro usuario | SIN_PERMISO |
| 404 | No existe el recurso o la ruta | PEDIDO_NO_ENCONTRADO, PLATILLO_NO_ENCONTRADO, RUTA_NO_ENCONTRADA |
| 409 | Choca con el estado actual | CORREO_REGISTRADO, CAMBIO_NO_PERMITIDO, PEDIDO_TOMADO, YA_ENTREGADO, YA_EVALUADO, PLAN_YA_CONTRATADO, SIN_PLAN, SIN_STOCK, PAGO_YA_USADO |
| 413 | El cuerpo supera los 100 KB | CUERPO_DEMASIADO_GRANDE |
| 422 | Los datos tienen el formato correcto, pero no cumplen las reglas del negocio | CLAVE_DEBIL, BIOMETRIA_INVALIDA, TELEFONO_INVALIDO, VARIOS_RESTAURANTES, NOTA_INVALIDA, DATOS_TARJETA_NO_PERMITIDOS, LIMITE_FOTOS, SIN_DATOS_NUTRICIONALES |
| 423 | PIN bloqueado por intentos | PIN_BLOQUEADO |
| 429 | Se superó un límite de solicitudes | DEMASIADAS_SOLICITUDES |
| 500 | Error inesperado (el detalle queda en el registro del servidor, no se envía al cliente) | ERROR_INTERNO |
| 503 | MongoDB no está disponible | BD_NO_DISPONIBLE |

## 5. Ejemplos

**Iniciar sesión** (`-c` guarda la cookie en un archivo; `-b` la envía después)

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"andrea@mail.com","password":"<contraseña>"}'
```

```
HTTP 200
Set-Cookie: kalo_sesion=eyJhbGciOi…; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800

{ "exito": true, "mensaje": "¡Bienvenido(a) a Kalo, Andrea Gómez!", "expira_en": "8h",
  "usuario": { "id": "6620f1a4e13b8a1c90000001", "nombre": "Andrea Gómez", "rol": "cliente",
               "perfil_biometrico": { "imc": 25.2, "meta_calorica_diaria": 1550 } } }
```

**Crear un pedido (cliente)**

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/mongo/pedidos \
  -H "Content-Type: application/json" \
  -d '{"items":[{"platillo_id":"6620f6e3e13b8a1c90000001","cantidad":1}],
       "pago":{"referencia":"pay_sim_4k2j9x0a1b2c3d4e5f6g","marca":"Visa","ultimos4":"1111","metodo":"credito"}}'
```

```json
{ "exito": true, "mensaje": "¡Pago aprobado! Pedido KALO-2026-677749 enviado al local. Verás tu PIN de entrega cuando salga.",
  "pedido": { "codigo_pedido": "KALO-2026-677749", "estado": "Pagado", "total": 9990, "total_calorias": 520 } }
```

**Validar un PIN incorrecto (repartidor, con su propia cookie)**

```bash
curl -b cookies-repartidor.txt -X POST http://localhost:3000/api/mongo/pedidos/validar-pin \
  -H "Content-Type: application/json" -d '{"codigo_pedido":"KALO-2026-677749","pin_ingresado":"0000"}'
```

```json
{ "exito": false, "codigo": "PIN_INCORRECTO", "mensaje": "PIN de entrega incorrecto. Te quedan 4 intento(s)." }
```

**Ruta protegida sin sesión, y sesión ya cerrada**

```json
HTTP 401  { "exito": false, "codigo": "NO_AUTENTICADO", "mensaje": "Debes iniciar sesión para usar esta función." }
HTTP 401  { "exito": false, "codigo": "SESION_CERRADA", "mensaje": "Tu sesión se cerró. Inicia sesión de nuevo." }
```

El archivo `scripts/probarApi.js` (`npm run test:api`) ejecuta 84 pruebas de este tipo sobre el flujo completo.

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

## 8. Requisitos no funcionales en el código (Etapa 3)

| Requisito | Cómo se cumple |
|---|---|
| RNF-01 Mobile-first | Grilla de Bootstrap: barra inferior en celular, filtros en panel deslizable, tablero en columnas en escritorio. |
| Base relacional | PostgreSQL (`src/config/postgres.js`, `src/Modelos/sql/`): tablas cuentas, sesiones, pagos, accesos y alimentos_usda. Todas las consultas son parametrizadas (`$1, $2`), nunca se concatena texto en el SQL. |
| RNF-02 Datos de salud | Contraseñas con bcrypt. Peso, altura, edad, IMC, meta y objetivo se guardan cifrados con AES-256-GCM (`src/utils/cifrado.js`, clave `DATOS_SALUD_CLAVE`). `npm run cifrar-salud` cifra las cuentas antiguas. |
| RNF-03 Rendimiento | Compresión gzip, índices en `platillos`, `restaurantes`, `pedidos` y `fotos_cocina`, consultas `lean()`, pantallas cargadas por partes (code splitting) y caché de imágenes. |
| RNF-04 Disponibilidad | `GET /api/salud` para el monitor, reconexión automática a Atlas, cierre ordenado con SIGTERM y aviso "sin conexión" en la app. |
| RNF-05 Imágenes | Las fotos se comprimen en el navegador (máx. 1.200 px, JPEG) antes de subirlas; el servidor rechaza las de más de 500 KB. |
| RNF-06 Concurrencia | API sin estado (JWT), pool de hasta 50 conexiones a Atlas, límites por IP. |
| RNF-07 Pagos | Pasarela en modo de prueba (`frontend/src/api/pasarela.js`); Kalo solo recibe la referencia y los últimos 4 dígitos y rechaza números de tarjeta (422). |
| RNF-08 Accesibilidad | Modo alto contraste y texto grande, foco visible, etiquetas en todos los campos, "Saltar al contenido" y `prefers-reduced-motion`. |
| RNF-09 Ley 21.719 | Botón "Eliminar mis datos" (borra cuenta, pedidos y avisos); los datos públicos nunca incluyen correo, teléfono ni salud. |
| RNF-10 Mantenibilidad | Capas rutas → middleware → controladores → modelos, y middleware `sanitizar` contra inyección NoSQL. Cabeceras de seguridad con Helmet. |
