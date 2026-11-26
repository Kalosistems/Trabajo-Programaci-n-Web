/**
 * Prueba automática de la API (npm run test:api) con el servidor corriendo.
 * Requiere los datos de "npm run seed". Recorre el flujo completo del pedido
 * y comprueba los códigos de error documentados en docs/API.md.
 */
const BASE = process.env.API_URL || 'http://localhost:3000';
let ok = 0, fallos = 0;
// Respuesta de la pasarela de pago en modo de prueba (Kalo nunca recibe el número de tarjeta).
// Cada pago tiene su propia referencia: PostgreSQL no deja usar dos veces la misma.
let nPago = 0;
const nuevoPago = () => ({ referencia: 'pay_sim_' + Date.now().toString(36) + 'prueba' + String(++nPago).padStart(6, '0'), marca: 'Visa', ultimos4: '1111', metodo: 'credito' });
const PAGO = nuevoPago();

// "token" es la cookie de sesión (kalo_sesion=...): el JWT nunca viaja en el JSON
async function llamar(metodo, ruta, { token, body, crudo } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Cookie = token;
    const res = await fetch(BASE + ruta, { method: metodo, headers, body: crudo ?? (body ? JSON.stringify(body) : undefined) });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    const cookie = (res.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).find(c => c.startsWith('kalo_sesion=') && c.length > 13) || null;
    const banderas = (res.headers.getSetCookie?.() || []).join(';');
    return { status: res.status, data, cookie, banderas };
}

function revisar(nombre, condicion, detalle = '') {
    if (condicion) { ok++; console.log(`  ✔ ${nombre}`); }
    else { fallos++; console.log(`  ✘ ${nombre} ${detalle}`); }
}

(async () => {
    console.log(`Probando ${BASE}\n`);

    // Disponibilidad y seguridad
    let r0 = await llamar('GET', '/api/salud');
    revisar('GET /api/salud → 200 con MongoDB y PostgreSQL conectadas (RNF-04)', r0.status === 200 && r0.data.mongodb === 'conectada' && r0.data.postgresql === 'conectada');
    r0 = await llamar('POST', '/api/login', { body: { correo: { $ne: null }, password: 'x' } });
    revisar('inyección NoSQL { $ne } → 400 (RNF-10)', r0.status === 400 && r0.data.codigo === 'DATOS_NO_PERMITIDOS');

    // Autenticación
    let r = await llamar('POST', '/api/login', { body: { correo: 'andrea@mail.com', password: 'otraClave1' } });
    revisar('login con contraseña incorrecta → 401', r.status === 401 && r.data.codigo === 'CREDENCIALES_INVALIDAS');
    r = await llamar('POST', '/api/login', { body: { correo: 'noexiste@mail.com', password: 'Kalo1234' } });
    revisar('login con correo inexistente → 401 (mismo mensaje)', r.status === 401 && r.data.mensaje === 'Correo o contraseña incorrectos');
    r = await llamar('POST', '/api/login', { body: { correo: 'andrea@mail.com' } });
    revisar('login sin contraseña → 400', r.status === 400);
    r = await llamar('POST', '/api/login', { crudo: '{"correo": ' });
    revisar('JSON mal formado → 400 JSON_INVALIDO', r.status === 400 && r.data.codigo === 'JSON_INVALIDO');

    const cli = await llamar('POST', '/api/login', { body: { correo: 'andrea@mail.com', password: 'Kalo1234' } });
    revisar('login cliente → 200, cookie httpOnly y sin token ni contraseña en el JSON', cli.status === 200 && !!cli.cookie && /HttpOnly/i.test(cli.banderas) && /SameSite=Strict/i.test(cli.banderas) && !('token' in cli.data) && !JSON.stringify(cli.data).includes('password'));
    revisar('el login entrega el perfil descifrado con IMC y meta (RF-02, RF-03)', cli.data.usuario.perfil_biometrico.imc > 0 && cli.data.usuario.perfil_biometrico.meta_calorica_diaria >= 1200);
    const res_ = await llamar('POST', '/api/login', { body: { correo: 'contacto@greenbowl.cl', password: 'Kalo1234' } });
    revisar('login restaurante → 200 rol restaurante', res_.status === 200 && res_.data.usuario.rol === 'restaurante');
    const rep = await llamar('POST', '/api/login', { body: { correo: 'carlos.reparto@kalo.cl', password: 'Kalo1234' } });
    revisar('login repartidor → 200 rol repartidor', rep.status === 200 && rep.data.usuario.rol === 'repartidor');
    const tC = cli.cookie, tR = res_.cookie, tD = rep.cookie;
    r = await llamar('GET', '/api/sesion', { token: tC });
    revisar('GET /api/sesion con la cookie → usuario conectado (verificado en PostgreSQL)', r.status === 200 && r.data.usuario.correo === 'andrea@mail.com');
    const otraSesion = (await llamar('POST', '/api/login', { body: { correo: 'andrea@mail.com', password: 'Kalo1234' } })).cookie;
    r = await llamar('POST', '/api/logout', { token: otraSesion });
    revisar('cerrar sesión → 200', r.status === 200);
    r = await llamar('GET', '/api/sesion', { token: otraSesion });
    revisar('la sesión cerrada queda revocada en PostgreSQL → 401 SESION_CERRADA', r.status === 401 && r.data.codigo === 'SESION_CERRADA');

    // Registro
    const correoNuevo = `prueba${Date.now()}@mail.com`;
    r = await llamar('POST', '/api/registro', { body: { nombre: 'Prueba', correo: correoNuevo, password: 'debil', peso: 70, altura: 1.7, edad: 30 } });
    revisar('registro con contraseña débil → 422', r.status === 422 && r.data.codigo === 'CLAVE_DEBIL');
    r = await llamar('POST', '/api/registro', { body: { nombre: 'Prueba', correo: correoNuevo, password: 'Segura123', peso: 70, altura: 1.7, edad: 30, genero: 'Masculino', nivel_actividad: 'moderado', objetivo: 'mantener' } });
    revisar('registro cliente → 201 con meta de Mifflin-St Jeor (2.500 kcal)', r.status === 201 && !!r.cookie && r.data.usuario.perfil_biometrico.meta_calorica_diaria === 2500, JSON.stringify(r.data.usuario && r.data.usuario.perfil_biometrico));
    const tNuevo = r.cookie, idNuevo = r.data.usuario && r.data.usuario.id;
    r = await llamar('POST', '/api/registro', { body: { nombre: 'Prueba', correo: correoNuevo, password: 'Segura123', peso: 70, altura: 1.7, edad: 30 } });
    revisar('registro con correo repetido → 409', r.status === 409 && r.data.codigo === 'CORREO_REGISTRADO');
    r = await llamar('POST', '/api/login', { body: { correo: correoNuevo, password: 'Segura123' } });
    revisar('la cuenta nueva inicia sesión (hash bcrypt)', r.status === 200);

    // Catálogo público y consultas
    r = await llamar('GET', '/api/mongo/platillos');
    revisar('GET platillos (público) → 200', r.status === 200 && r.data.total >= 3);
    const platillos = r.data.datos;
    revisar('catálogo ordenado por el índice del local (RF-11)', platillos.every((p, i) => i === 0 || platillos[i - 1].restaurante_id.indice_transparencia >= p.restaurante_id.indice_transparencia));
    revisar('el catálogo no expone correo ni hash del local', !platillos.some(p => p.restaurante_id.correo || p.restaurante_id.password_hash));
    r = await llamar('GET', '/api/mongo/platillos?maxCarbohidratos=30&maxPrecio=6000&minTransparencia=90');
    revisar('filtros bajo en carbohidratos, presupuesto y transparencia (RF-04)', r.status === 200 && r.data.datos.length >= 1 && r.data.datos.every(p => p.macronutrientes.carbohidratos_g <= 30 && p.precio <= 6000 && p.indice_transparencia >= 90));
    r = await llamar('GET', '/api/mongo/restaurantes');
    revisar('ranking de restaurantes por índice (RF-11)', r.status === 200 && r.data.datos.length >= 2 && r.data.datos[0].indice_transparencia >= r.data.datos[1].indice_transparencia);
    const local = r.data.datos.find(x => x.nombre.includes('Green'));
    r = await llamar('GET', '/api/mongo/restaurantes/' + local._id);
    revisar('perfil público del local con galería de la cocina (RF-07)', r.status === 200 && r.data.datos.fotos.length >= 1 && r.data.datos.platillos.length >= 1 && !r.data.datos.restaurante.correo);
    r = await llamar('POST', '/api/mongo/nutricion/calcular', { body: { ingredientes: [{ nombre: 'Pechuga de pollo', cantidad_g: 150, metodo_coccion: 'Plancha' }, { nombre: 'Arroz', cantidad_g: 100 }] } });
    revisar('cálculo nutricional automático (RF-08)', r.status === 200 && r.data.datos.calorias === 378 && r.data.datos.proteinas > 40, JSON.stringify(r.data).slice(0, 200));
    r = await llamar('GET', '/api/mongo/platillos?maxCalorias=abc');
    revisar('GET platillos con parámetro inválido → 400', r.status === 400);
    r = await llamar('GET', '/api/mongo/platillos?busqueda=(');
    revisar('búsqueda con caracteres especiales no rompe ($regex escapado)', r.status === 200);
    r = await llamar('GET', '/api/mongo/platillos-fit?maxCalorias=500');
    revisar('$lte platillos ≤ 500 kcal', r.status === 200 && r.data.datos.every(p => p.calorias <= 500));
    r = await llamar('GET', '/api/mongo/platillos-con-restaurante');
    revisar('$lookup platillos + restaurante', r.status === 200 && r.data.datos[0].restaurante);
    r = await llamar('GET', '/api/mongo/planes?precioMin=20');
    revisar('$gt + sort planes', r.status === 200 && r.data.datos.every(p => p.precio_mensual > 20));
    r = await llamar('GET', '/api/mongo/estadisticas');
    revisar('estadísticas sin token → 401', r.status === 401 && r.data.codigo === 'NO_AUTENTICADO');
    r = await llamar('GET', '/api/mongo/estadisticas', { token: tC });
    revisar('$group estadísticas con token → 200 con promedios descifrados', r.status === 200 && r.data.datos.length >= 1 && r.data.datos[0].imcPromedio > 0);
    r = await llamar('GET', '/api/mongo/usuarios-pedidos', { token: tC });
    revisar('LEFT JOIN clientes con o sin pedidos', r.status === 200 && r.data.datos.some(u => u.cantidad_pedidos === 0));
    r = await llamar('GET', '/api/mongo/usuarios', { token: tC });
    revisar('GET usuarios sin correo ni contraseña', r.status === 200 && !r.data.datos.some(u => u.correo || u.password_hash));
    r = await llamar('GET', '/api/mongo/pedidos', { token: 'kalo_sesion=token-falso' });
    revisar('token inválido → 401 TOKEN_INVALIDO', r.status === 401 && r.data.codigo === 'TOKEN_INVALIDO');

    // Flujo del pedido
    const bowl = platillos.find(p => p.nombre.includes('Salmón'));
    const wrap = platillos.find(p => p.nombre.includes('Wrap'));
    const pechuga = platillos.find(p => p.nombre.includes('Pechuga'));
    r = await llamar('POST', '/api/mongo/pedidos', { token: tR, body: { items: [{ platillo_id: bowl._id, cantidad: 1 }], pago: nuevoPago() } });
    revisar('restaurante no puede comprar → 403', r.status === 403 && r.data.codigo === 'SIN_PERMISO');
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [] } });
    revisar('carrito vacío → 400', r.status === 400 && r.data.codigo === 'CARRITO_VACIO');
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [{ platillo_id: bowl._id }, { platillo_id: pechuga._id }], pago: nuevoPago() } });
    revisar('platillos de dos locales → 422', r.status === 422 && r.data.codigo === 'VARIOS_RESTAURANTES');
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [{ platillo_id: bowl._id }] } });
    revisar('pedido sin pago de la pasarela → 402 (RNF-07)', r.status === 402 && r.data.codigo === 'PAGO_REQUERIDO');
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [{ platillo_id: bowl._id }], pago: { ...nuevoPago(), numero: '4111 1111 1111 1111' } } });
    revisar('enviar un número de tarjeta a Kalo → 422 (RNF-07)', r.status === 422 && r.data.codigo === 'DATOS_TARJETA_NO_PERMITIDOS');
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [{ platillo_id: bowl._id, cantidad: 2, precio: 1 }, { platillo_id: wrap._id, cantidad: 1 }], pago: PAGO } });
    const totalEsperado = bowl.precio * 2 + wrap.precio + 1490;
    revisar('crear pedido → 201 "Pagado", total calculado en el servidor, sin PIN', r.status === 201 && r.data.pedido.estado === 'Pagado' && r.data.pedido.total === totalEsperado && !r.data.pedido.pin_seguridad, JSON.stringify(r.data).slice(0, 200));
    revisar('el pedido guarda las calorías (RF-03)', r.data.pedido.total_calorias === bowl.calorias * 2 + wrap.calorias);
    const codigo = r.data.pedido.codigo_pedido;
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [{ platillo_id: bowl._id }], pago: PAGO } });
    revisar('usar dos veces el mismo pago → 409 PAGO_YA_USADO (UNIQUE en PostgreSQL)', r.status === 409 && r.data.codigo === 'PAGO_YA_USADO');
    r = await llamar('GET', '/api/mongo/notificaciones', { token: tR });
    revisar('el restaurante recibe el aviso de nuevo pedido (RF-20)', r.status === 200 && r.data.datos.some(n => n.tipo === 'nuevo_pedido' && n.codigo_pedido === codigo));
    r = await llamar('PUT', '/api/mongo/pedidos/estado', { token: tR, body: { codigo_pedido: codigo, nuevo_estado: 'En Preparación' } });
    revisar('el restaurante acepta el pedido → En Preparación (RF-20)', r.status === 200 && r.data.pedido.estado === 'En Preparación');

    r = await llamar('PUT', '/api/mongo/pedidos/estado', { token: tR, body: { codigo_pedido: codigo, nuevo_estado: 'Entregado' } });
    revisar('saltar a Entregado → 409', r.status === 409 && r.data.codigo === 'CAMBIO_NO_PERMITIDO');
    r = await llamar('PUT', '/api/mongo/pedidos/estado', { token: tR, body: { codigo_pedido: codigo, nuevo_estado: 'Volando' } });
    revisar('estado inexistente → 422', r.status === 422);
    r = await llamar('PUT', '/api/mongo/pedidos/estado', { token: tR, body: { codigo_pedido: codigo, nuevo_estado: 'En Camino', repartidor_id: rep.data.usuario.id } });
    revisar('despachar → 200 y el restaurante NO ve el PIN', r.status === 200 && r.data.pedido.estado === 'En Camino' && !('pin_seguridad' in r.data.pedido));

    r = await llamar('GET', '/api/mongo/pedidos', { token: tD });
    const vistoRep = r.data.datos.find(p => p.codigo_pedido === codigo);
    revisar('el repartidor ve su pedido, pero sin PIN', vistoRep && !('pin_seguridad' in vistoRep));
    r = await llamar('GET', '/api/mongo/pedidos', { token: tC });
    const vistoCli = r.data.datos.find(p => p.codigo_pedido === codigo);
    revisar('el cliente ve su PIN de 4 dígitos', vistoCli && /^\d{4}$/.test(vistoCli.pin_seguridad));
    r = await llamar('GET', '/api/mongo/notificaciones', { token: tC });
    revisar('aviso "tu pedido salió" sin PIN (RF-23)', r.data.datos.some(n => n.tipo === 'pedido_en_camino' && n.codigo_pedido === codigo && !n.mensaje.includes(vistoCli.pin_seguridad)));
    r = await llamar('PUT', '/api/mongo/pedidos/cerca', { token: tD, body: { codigo_pedido: codigo } });
    revisar('el repartidor avisa que está a 5 minutos (RF-23)', r.status === 200);
    r = await llamar('GET', '/api/mongo/notificaciones', { token: tC });
    revisar('el cliente recibe "tu repartidor está cerca"', r.data.datos.some(n => n.tipo === 'repartidor_cerca' && n.codigo_pedido === codigo));
    const consumoAntes = (await llamar('GET', '/api/mongo/usuarios/consumo', { token: tC })).data.datos.consumidas_hoy;
    r = await llamar('GET', '/api/mongo/pedidos', { token: tNuevo });
    revisar('otro cliente no ve pedidos ajenos', r.status === 200 && !r.data.datos.some(p => p.codigo_pedido === codigo));

    const pinMalo = vistoCli.pin_seguridad === '0000' ? '1111' : '0000';
    r = await llamar('POST', '/api/mongo/pedidos/validar-pin', { token: tD, body: { codigo_pedido: codigo, pin_ingresado: '12' } });
    revisar('PIN con formato inválido → 422', r.status === 422);
    r = await llamar('POST', '/api/mongo/pedidos/validar-pin', { token: tD, body: { codigo_pedido: codigo, pin_ingresado: pinMalo } });
    revisar('PIN incorrecto → 401 con intentos restantes', r.status === 401 && r.data.codigo === 'PIN_INCORRECTO' && /4 intento/.test(r.data.mensaje));
    r = await llamar('POST', '/api/mongo/pedidos/evaluar', { token: tC, body: { codigo_pedido: codigo, similitud_foto: 5, gramaje_porcion: 4, velocidad_prep: 5, calificacion_general: 5 } });
    revisar('evaluar antes de la entrega → 409', r.status === 409);
    r = await llamar('POST', '/api/mongo/pedidos/validar-pin', { token: tD, body: { codigo_pedido: codigo, pin_ingresado: vistoCli.pin_seguridad } });
    revisar('PIN correcto → 200 Entregado', r.status === 200 && r.data.pedido.estado === 'Entregado');
    r = await llamar('GET', '/api/mongo/usuarios/consumo', { token: tC });
    revisar('al entregar se suman las calorías del día (RF-03)', r.status === 200 && r.data.datos.consumidas_hoy === consumoAntes + bowl.calorias * 2 + wrap.calorias, JSON.stringify(r.data.datos));
    r = await llamar('POST', '/api/mongo/pedidos/validar-pin', { token: tD, body: { codigo_pedido: codigo, pin_ingresado: vistoCli.pin_seguridad } });
    revisar('validar de nuevo → 409 YA_ENTREGADO', r.status === 409);
    r = await llamar('POST', '/api/mongo/pedidos/evaluar', { token: tC, body: { codigo_pedido: codigo, similitud_foto: 9, gramaje_porcion: 4, velocidad_prep: 5, calificacion_general: 5 } });
    revisar('nota fuera de 1..5 → 422', r.status === 422);
    r = await llamar('POST', '/api/mongo/pedidos/evaluar', { token: tC, body: { codigo_pedido: codigo, similitud_foto: 5, gramaje_porcion: 4, velocidad_prep: 5, calificacion_general: 5, comentario: 'Igual a la foto' } });
    revisar('evaluar pedido entregado → 200 y recalcula el índice del local (RF-14)', r.status === 200 && r.data.indice_restaurante > 0);
    r = await llamar('POST', '/api/mongo/pedidos/evaluar', { token: tC, body: { codigo_pedido: codigo, similitud_foto: 5, gramaje_porcion: 4, velocidad_prep: 5, calificacion_general: 5 } });
    revisar('evaluar dos veces → 409', r.status === 409);

    // Platillo, perfil y cambio hipotético (propagación del nombre)
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Ensalada test', precio: 0, calorias: 300 } });
    revisar('platillo con precio 0 → 422', r.status === 422);
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Ensalada test', precio: 5990, calorias: 300, imagen_url: 'data:text/html;base64,PHNjcmlwdD4=' } });
    revisar('foto que no es imagen → 422', r.status === 422 && r.data.codigo === 'IMAGEN_INVALIDA');
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Ensalada test', precio: 5990, calorias: 300, imagen_url: 'data:image/jpeg;base64,' + 'A'.repeat(800000) } });
    revisar('foto demasiado grande → 413', r.status === 413);
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Ensalada test', precio: 5990, calorias: 300, proteinas: 20, ingredientes: [{ nombre: 'Lechuga', cantidad_g: 80 }] } });
    revisar('crear platillo → 201 con índice de transparencia (RF-09)', r.status === 201 && r.data.platillo.indice_transparencia === 55, String(r.data.platillo && r.data.platillo.indice_transparencia));
    const idEnsalada = r.data.platillo._id;
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Bowl calculado', precio: 6990, calcular_nutricion: true, ingredientes: [{ nombre: 'Pollo', cantidad_g: 150, metodo_coccion: 'Plancha' }, { nombre: 'Quinoa', cantidad_g: 100, metodo_coccion: 'Hervido' }] } });
    revisar('platillo sin calorías: Kalo las calcula con los ingredientes (RF-08)', r.status === 201 && r.data.platillo.nutricion_calculada && r.data.platillo.calorias > 300);
    r = await llamar('PUT', '/api/mongo/platillos/' + idEnsalada + '/estado', { token: tR, body: { activo: false } });
    revisar('retirar un platillo del menú', r.status === 200 && r.data.platillo.activo === false);
    r = await llamar('POST', '/api/mongo/restaurantes/fotos', { token: tR, body: { imagen: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==', descripcion: 'Mesón de prueba' } });
    revisar('subir foto de la cocina (RF-07)', r.status === 201 && !!r.data.foto.url);
    const idFoto = r.data.foto && r.data.foto._id;
    const rf = await fetch(BASE + '/api/mongo/restaurantes/fotos/' + idFoto);
    revisar('la foto se sirve como imagen', rf.status === 200 && rf.headers.get('content-type').startsWith('image/jpeg'));
    r = await llamar('DELETE', '/api/mongo/restaurantes/fotos/' + idFoto, { token: tR });
    revisar('eliminar foto de la cocina', r.status === 200);

    // Planes nutricionales (RF-21)
    const planes = (await llamar('GET', '/api/mongo/planes')).data.datos;
    r = await llamar('POST', '/api/mongo/planes/contratar', { token: tNuevo, body: { plan_id: planes[0]._id, pago: nuevoPago() } });
    revisar('contratar plan → 201 y la meta pasa a la del plan', r.status === 201 && r.data.usuario.perfil_biometrico.meta_calorica_diaria === planes[0].calorias_diarias && r.data.pedido.plan_adquirido.nombre_plan === planes[0].nombre_plan);
    r = await llamar('POST', '/api/mongo/planes/contratar', { token: tNuevo, body: { plan_id: planes[0]._id, pago: nuevoPago() } });
    revisar('contratar el mismo plan otra vez → 409', r.status === 409);
    r = await llamar('DELETE', '/api/mongo/planes/contrato', { token: tNuevo });
    revisar('cancelar el plan → la meta vuelve a la recomendada', r.status === 200 && !r.data.usuario.plan_activo && r.data.usuario.perfil_biometrico.meta_calorica_diaria === 2500);
    r = await llamar('PUT', '/api/mongo/usuarios/biometrico', { token: tC, body: { peso: 500 } });
    revisar('peso fuera de rango → 422', r.status === 422);
    r = await llamar('PUT', '/api/mongo/usuarios/biometrico', { token: tC, body: { peso: 67, nombre: 'Andrea Gómez P.' } });
    revisar('cambiar nombre actualiza la copia en sus pedidos (updateMany)', r.status === 200 && r.data.pedidos_actualizados >= 1);
    await llamar('PUT', '/api/mongo/usuarios/biometrico', { token: tC, body: { nombre: 'Andrea Gómez' } });

    r = await llamar('DELETE', `/api/mongo/usuarios/${cli.data.usuario.id}`, { token: tNuevo });
    revisar('borrar la cuenta de otro → 403', r.status === 403);
    r = await llamar('DELETE', `/api/mongo/usuarios/${idNuevo}`, { token: tNuevo });
    revisar('borrar mi cuenta → 200', r.status === 200);
    r = await llamar('POST', '/api/login', { body: { correo: correoNuevo, password: 'Segura123' } });
    revisar('la cuenta borrada ya no existe en PostgreSQL → 401', r.status === 401);

    r = await llamar('GET', '/api/mongo/no-existe');
    revisar('ruta inexistente → 404 JSON', r.status === 404 && r.data.codigo === 'RUTA_NO_ENCONTRADA');

    console.log(`\nResultado: ${ok} correctas, ${fallos} con error`);
    process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('No se pudo conectar con la API:', e.message); process.exit(1); });
