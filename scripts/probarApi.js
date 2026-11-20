/**
 * Prueba automática de la API (npm run test:api) con el servidor corriendo.
 * Requiere los datos de "npm run seed". Recorre el flujo completo del pedido
 * y comprueba los códigos de error documentados en docs/API.md.
 */
const BASE = process.env.API_URL || 'http://localhost:3000';
let ok = 0, fallos = 0;

async function llamar(metodo, ruta, { token, body, crudo } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(BASE + ruta, { method: metodo, headers, body: crudo ?? (body ? JSON.stringify(body) : undefined) });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { status: res.status, data };
}

function revisar(nombre, condicion, detalle = '') {
    if (condicion) { ok++; console.log(`  ✔ ${nombre}`); }
    else { fallos++; console.log(`  ✘ ${nombre} ${detalle}`); }
}

(async () => {
    console.log(`Probando ${BASE}\n`);

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
    revisar('login cliente → 200 con token y sin password_hash', cli.status === 200 && cli.data.token && !('password_hash' in cli.data.usuario));
    const res_ = await llamar('POST', '/api/login', { body: { correo: 'contacto@greenbowl.cl', password: 'Kalo1234' } });
    revisar('login restaurante → 200 rol restaurante', res_.status === 200 && res_.data.usuario.rol === 'restaurante');
    const rep = await llamar('POST', '/api/login', { body: { correo: 'carlos.reparto@kalo.cl', password: 'Kalo1234' } });
    revisar('login repartidor → 200 rol repartidor', rep.status === 200 && rep.data.usuario.rol === 'repartidor');
    const tC = cli.data.token, tR = res_.data.token, tD = rep.data.token;

    // Registro
    const correoNuevo = `prueba${Date.now()}@mail.com`;
    r = await llamar('POST', '/api/registro', { body: { nombre: 'Prueba', correo: correoNuevo, password: 'debil', peso: 70, altura: 1.7, edad: 30 } });
    revisar('registro con contraseña débil → 422', r.status === 422 && r.data.codigo === 'CLAVE_DEBIL');
    r = await llamar('POST', '/api/registro', { body: { nombre: 'Prueba', correo: correoNuevo, password: 'Segura123', peso: 70, altura: 1.7, edad: 30, genero: 'Otro' } });
    revisar('registro cliente → 201 con token', r.status === 201 && !!r.data.token);
    const tNuevo = r.data.token, idNuevo = r.data.usuario && r.data.usuario.id;
    r = await llamar('POST', '/api/registro', { body: { nombre: 'Prueba', correo: correoNuevo, password: 'Segura123', peso: 70, altura: 1.7, edad: 30 } });
    revisar('registro con correo repetido → 409', r.status === 409 && r.data.codigo === 'CORREO_REGISTRADO');
    r = await llamar('POST', '/api/login', { body: { correo: correoNuevo, password: 'Segura123' } });
    revisar('la cuenta nueva inicia sesión (hash bcrypt)', r.status === 200);

    // Catálogo público y consultas
    r = await llamar('GET', '/api/mongo/platillos');
    revisar('GET platillos (público) → 200', r.status === 200 && r.data.total >= 3);
    const platillos = r.data.datos;
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
    revisar('$group estadísticas con token → 200', r.status === 200 && r.data.datos.length >= 1);
    r = await llamar('GET', '/api/mongo/usuarios-pedidos', { token: tC });
    revisar('LEFT JOIN clientes con o sin pedidos', r.status === 200 && r.data.datos.some(u => u.cantidad_pedidos === 0));
    r = await llamar('GET', '/api/mongo/usuarios', { token: tC });
    revisar('GET usuarios sin correo ni contraseña', r.status === 200 && !r.data.datos.some(u => u.correo || u.password_hash));
    r = await llamar('GET', '/api/mongo/pedidos', { token: 'token-falso' });
    revisar('token inválido → 401 TOKEN_INVALIDO', r.status === 401 && r.data.codigo === 'TOKEN_INVALIDO');

    // Flujo del pedido
    const bowl = platillos.find(p => p.nombre.includes('Salmón'));
    const wrap = platillos.find(p => p.nombre.includes('Wrap'));
    const pechuga = platillos.find(p => p.nombre.includes('Pechuga'));
    r = await llamar('POST', '/api/mongo/pedidos', { token: tR, body: { items: [{ platillo_id: bowl._id, cantidad: 1 }] } });
    revisar('restaurante no puede comprar → 403', r.status === 403 && r.data.codigo === 'SIN_PERMISO');
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [] } });
    revisar('carrito vacío → 400', r.status === 400 && r.data.codigo === 'CARRITO_VACIO');
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [{ platillo_id: bowl._id }, { platillo_id: pechuga._id }] } });
    revisar('platillos de dos locales → 422', r.status === 422 && r.data.codigo === 'VARIOS_RESTAURANTES');
    r = await llamar('POST', '/api/mongo/pedidos', { token: tC, body: { items: [{ platillo_id: bowl._id, cantidad: 2, precio: 1 }, { platillo_id: wrap._id, cantidad: 1 }] } });
    const totalEsperado = bowl.precio * 2 + wrap.precio + 1490;
    revisar('crear pedido → 201, total calculado en el servidor, sin PIN', r.status === 201 && r.data.pedido.total === totalEsperado && !r.data.pedido.pin_seguridad, JSON.stringify(r.data).slice(0, 200));
    const codigo = r.data.pedido.codigo_pedido;

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
    r = await llamar('POST', '/api/mongo/pedidos/validar-pin', { token: tD, body: { codigo_pedido: codigo, pin_ingresado: vistoCli.pin_seguridad } });
    revisar('validar de nuevo → 409 YA_ENTREGADO', r.status === 409);
    r = await llamar('POST', '/api/mongo/pedidos/evaluar', { token: tC, body: { codigo_pedido: codigo, similitud_foto: 9, gramaje_porcion: 4, velocidad_prep: 5, calificacion_general: 5 } });
    revisar('nota fuera de 1..5 → 422', r.status === 422);
    r = await llamar('POST', '/api/mongo/pedidos/evaluar', { token: tC, body: { codigo_pedido: codigo, similitud_foto: 5, gramaje_porcion: 4, velocidad_prep: 5, calificacion_general: 5, comentario: 'Igual a la foto' } });
    revisar('evaluar pedido entregado → 200', r.status === 200);

    // Platillo, perfil y cambio hipotético (propagación del nombre)
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Ensalada test', precio: 0, calorias: 300 } });
    revisar('platillo con precio 0 → 422', r.status === 422);
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Ensalada test', precio: 5990, calorias: 300, imagen_url: 'data:text/html;base64,PHNjcmlwdD4=' } });
    revisar('foto que no es imagen → 422', r.status === 422 && r.data.codigo === 'IMAGEN_INVALIDA');
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Ensalada test', precio: 5990, calorias: 300, imagen_url: 'data:image/jpeg;base64,' + 'A'.repeat(800000) } });
    revisar('foto demasiado grande → 413', r.status === 413);
    r = await llamar('POST', '/api/mongo/platillos', { token: tR, body: { nombre: 'Ensalada test', precio: 5990, calorias: 300, proteinas: 20, ingredientes: [{ nombre: 'Lechuga', cantidad_g: 80 }] } });
    revisar('crear platillo → 201 con índice de transparencia', r.status === 201 && r.data.platillo.indice_transparencia === 70);
    r = await llamar('PUT', '/api/mongo/usuarios/biometrico', { token: tC, body: { peso: 500 } });
    revisar('peso fuera de rango → 422', r.status === 422);
    r = await llamar('PUT', '/api/mongo/usuarios/biometrico', { token: tC, body: { peso: 67, nombre: 'Andrea Gómez P.' } });
    revisar('cambiar nombre actualiza la copia en sus pedidos (updateMany)', r.status === 200 && r.data.pedidos_actualizados >= 1);
    await llamar('PUT', '/api/mongo/usuarios/biometrico', { token: tC, body: { nombre: 'Andrea Gómez' } });

    r = await llamar('DELETE', `/api/mongo/usuarios/${cli.data.usuario.id}`, { token: tNuevo });
    revisar('borrar la cuenta de otro → 403', r.status === 403);
    r = await llamar('DELETE', `/api/mongo/usuarios/${idNuevo}`, { token: tNuevo });
    revisar('borrar mi cuenta → 200', r.status === 200);

    r = await llamar('GET', '/api/mongo/no-existe');
    revisar('ruta inexistente → 404 JSON', r.status === 404 && r.data.codigo === 'RUTA_NO_ENCONTRADA');

    console.log(`\nResultado: ${ok} correctas, ${fallos} con error`);
    process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('No se pudo conectar con la API:', e.message); process.exit(1); });
