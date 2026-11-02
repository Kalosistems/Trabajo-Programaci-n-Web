/**
 * LÓGICA DE FRONTEND KALO (ETAPA 2 - NoSQL MONGODB ATLAS)
 * Incluye:
 * - Login por roles (Cliente, Restaurante, Repartidor)
 * - Carrito de compras con cálculo calórico acumulado
 * - Publicación de platillos desde el Restaurante
 * - Repartidor Mobile-First con aceptación de pedido y teclado PIN
 * - Consola NoSQL para evaluación docente ($lookup, $group, etc.)
 */

let usuarioActual = null;
let platillosGlobales = [];
let carrito = []; // Items en carrito { platillo_id, nombre, precio, calorias, cantidad }

// 1. NOTIFICACIONES TOAST (Manejo amigable de respuestas)
function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.className = `toast toast-${tipo}`;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// 2. AUTOCOMPLETADO RÁPIDO PARA PRESENTACIÓN
function autocompletarLogin(correo, pass) {
    document.getElementById('loginCorreo').value = correo;
    document.getElementById('loginPassword').value = pass;
    document.getElementById('formLogin').dispatchEvent(new Event('submit'));
}

// 3. PROCESO DE LOGIN
document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = document.getElementById('loginCorreo').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password })
        });

        const data = await respuesta.json();

        if (data.exito) {
            usuarioActual = data.usuario;
            mostrarToast(data.mensaje, 'success');
            mostrarAppPrincipal();
        } else {
            mostrarToast(data.mensaje || 'Credenciales inválidas', 'error');
        }
    } catch (error) {
        mostrarToast('Error al conectar con el servidor: ' + error.message, 'error');
    }
});

// 4. CAMBIO DE VISTA SEGÚN ROL
function mostrarAppPrincipal() {
    document.getElementById('pantallaLogin').classList.add('hidden');
    document.getElementById('appPrincipal').classList.remove('hidden');

    // Ocultar todas las vistas
    document.getElementById('vistaCliente').classList.add('hidden');
    document.getElementById('vistaRestaurante').classList.add('hidden');
    document.getElementById('vistaRepartidor').classList.add('hidden');

    const badge = document.getElementById('badgeRolUsuario');
    const headerNombre = document.getElementById('nombreUsuarioHeader');
    const btnCarrito = document.getElementById('btnVerCarrito');
    headerNombre.textContent = usuarioActual.nombre;

    if (usuarioActual.rol === 'cliente') {
        badge.textContent = 'Rol: Cliente';
        badge.className = 'badge';
        btnCarrito.classList.remove('hidden');
        document.getElementById('vistaCliente').classList.remove('hidden');
        cargarPerfilBiometrico();
        cargarCatalogoPlatillos();
        cargarPedidosCliente();
    } else if (usuarioActual.rol === 'restaurante') {
        badge.textContent = 'Rol: Restaurante';
        badge.className = 'badge badge-success';
        btnCarrito.classList.add('hidden');
        document.getElementById('vistaRestaurante').classList.remove('hidden');
        cargarPanelRestaurante();
    } else if (usuarioActual.rol === 'repartidor') {
        badge.textContent = 'Rol: Repartidor (Mobile-First)';
        badge.className = 'badge badge-success';
        btnCarrito.classList.add('hidden');
        document.getElementById('vistaRepartidor').classList.remove('hidden');
        cargarPanelRepartidor();
    }
}

// 5. CERRAR SESIÓN
function cerrarSesion() {
    usuarioActual = null;
    carrito = [];
    actualizarBadgeCarrito();
    document.getElementById('appPrincipal').classList.add('hidden');
    document.getElementById('pantallaLogin').classList.remove('hidden');
    document.getElementById('formLogin').reset();
    mostrarToast('Sesión cerrada correctamente', 'success');
}

/* =======================================================
   VISTA 1: CLIENTE & CARRITO DE COMPRAS
======================================================= */
function cargarPerfilBiometrico() {
    const bio = usuarioActual.perfil_biometrico;
    if (bio) {
        document.getElementById('bioPeso').textContent = `${bio.peso_kg} kg`;
        document.getElementById('bioAltura').textContent = `${bio.altura_m} m`;
        document.getElementById('bioIMC').textContent = bio.imc || (bio.peso_kg / (bio.altura_m * bio.altura_m)).toFixed(1);
        document.getElementById('bioCalorias').textContent = `${bio.meta_calorica_diaria || 2000} kcal`;
    }
}

async function cargarCatalogoPlatillos() {
    try {
        const res = await fetch('/api/mongo/platillos');
        const data = await res.json();
        if (data.exito) {
            platillosGlobales = data.datos;
            renderizarPlatillos(platillosGlobales);
        }
    } catch (error) {
        mostrarToast('Error al cargar catálogo de platillos', 'error');
    }
}

function renderizarPlatillos(lista) {
    const grid = document.getElementById('gridPlatillos');
    grid.innerHTML = '';

    lista.forEach(p => {
        const card = document.createElement('div');
        card.className = 'platillo-card';
        card.innerHTML = `
            <div>
                <div class="platillo-header">
                    <h4>🥗 ${p.nombre}</h4>
                    <span class="calorias-tag">${p.calorias} kcal</span>
                </div>
                <p style="font-size:12px; color:#4b5563; margin-bottom:8px;">${p.descripcion}</p>
                
                <div class="macros-box">
                    <div class="macro-item">
                        <span class="macro-val">${p.macronutrientes.proteinas_g}g</span>
                        Proteína
                    </div>
                    <div class="macro-item">
                        <span class="macro-val">${p.macronutrientes.carbohidratos_g}g</span>
                        Carbos
                    </div>
                    <div class="macro-item">
                        <span class="macro-val">${p.macronutrientes.grasas_g}g</span>
                        Grasas
                    </div>
                </div>
                
                <div style="font-size:11px; color:#059669; font-weight:600; margin-bottom:10px;">
                    ✓ Transparencia Nutricional: ${p.indice_transparencia || 95}%
                </div>
            </div>
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                    <strong style="font-size:16px; color:#111827;">$${p.precio.toLocaleString('es-CL')}</strong>
                    <button class="btn btn-primary btn-sm" onclick="agregarAlCarrito('${p._id}', '${p.nombre}', ${p.precio}, ${p.calorias})">
                        + Agregar al Carrito
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Filtro NoSQL con Operador $lte
async function aplicarFiltroCalorias() {
    const valor = document.getElementById('selectFiltroCalorias').value;
    if (valor === 'todas') {
        renderizarPlatillos(platillosGlobales);
    } else {
        try {
            const res = await fetch(`/api/mongo/platillos-fit?maxCalorias=${valor}`);
            const data = await res.json();
            if (data.exito) {
                renderizarPlatillos(data.datos);
                mostrarToast(`Filtro NoSQL ($lte): ${data.total} platillos encontrados`, 'success');
            }
        } catch (e) {
            mostrarToast('Error al filtrar platillos', 'error');
        }
    }
}

// CARRITO DE COMPRAS INTERACTIVO
function agregarAlCarrito(platilloId, nombre, precio, calorias) {
    const itemExistente = carrito.find(it => it.platillo_id === platilloId);
    if (itemExistente) {
        itemExistente.cantidad += 1;
    } else {
        carrito.push({
            platillo_id: platilloId,
            nombre,
            precio,
            calorias,
            cantidad: 1
        });
    }
    actualizarBadgeCarrito();
    mostrarToast(`Agregaste "${nombre}" al carrito`, 'success');
}

function actualizarBadgeCarrito() {
    const totalItems = carrito.reduce((sum, it) => sum + it.cantidad, 0);
    document.getElementById('contadorCarrito').textContent = totalItems;
}

function abrirModalCarrito() {
    renderizarContenidoCarrito();
    document.getElementById('modalCarrito').classList.remove('hidden');
}

function cerrarModalCarrito() {
    document.getElementById('modalCarrito').classList.add('hidden');
}

function renderizarContenidoCarrito() {
    const listaContenedor = document.getElementById('itemsCarritoLista');
    listaContenedor.innerHTML = '';

    if (carrito.length === 0) {
        listaContenedor.innerHTML = '<p style="text-align:center; color:#6b7280; padding:20px;">Tu carrito está vacío.</p>';
        document.getElementById('carritoTotalKcal').textContent = '0 kcal';
        document.getElementById('carritoTotalPrecio').textContent = '$0';
        return;
    }

    let sumaPrecio = 0;
    let sumaKcal = 0;

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        const subKcal = item.calorias * item.cantidad;
        sumaPrecio += subtotal;
        sumaKcal += subKcal;

        const fila = document.createElement('div');
        fila.className = 'carrito-item-fila';
        fila.innerHTML = `
            <div>
                <strong>${item.nombre}</strong><br>
                <small style="color:#6b7280;">$${item.precio.toLocaleString('es-CL')} c/u · ${item.calorias} kcal</small>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="btn btn-outline btn-sm" onclick="cambiarCantidadCarrito(${index}, -1)">-</button>
                <span>${item.cantidad}</span>
                <button class="btn btn-outline btn-sm" onclick="cambiarCantidadCarrito(${index}, 1)">+</button>
                <span style="font-weight:600; min-width:65px; text-align:right;">$${subtotal.toLocaleString('es-CL')}</span>
            </div>
        `;
        listaContenedor.appendChild(fila);
    });

    document.getElementById('carritoTotalKcal').textContent = `${sumaKcal} kcal`;
    document.getElementById('carritoTotalPrecio').textContent = `$${sumaPrecio.toLocaleString('es-CL')}`;
}

function cambiarCantidadCarrito(index, delta) {
    carrito[index].cantidad += delta;
    if (carrito[index].cantidad <= 0) {
        carrito.splice(index, 1);
    }
    actualizarBadgeCarrito();
    renderizarContenidoCarrito();
}

// Confirmar pedido desde el carrito
async function confirmarCompraCarrito() {
    if (carrito.length === 0) {
        mostrarToast('Tu carrito está vacío', 'error');
        return;
    }

    const sumaTotal = carrito.reduce((sum, it) => sum + (it.precio * it.cantidad), 0);

    try {
        const res = await fetch('/api/mongo/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario_id: usuarioActual.id,
                items: carrito,
                total: sumaTotal
            })
        });

        const data = await res.json();
        if (data.exito) {
            mostrarToast(`🎉 ${data.mensaje}`, 'success');
            carrito = [];
            actualizarBadgeCarrito();
            cerrarModalCarrito();
            cargarPedidosCliente();
        } else {
            mostrarToast(data.mensaje || 'Error al procesar pedido', 'error');
        }
    } catch (e) {
        mostrarToast('Error de red al procesar el pedido', 'error');
    }
}

// Cargar pedidos para ver el PIN
async function cargarPedidosCliente() {
    try {
        const res = await fetch('/api/mongo/pedidos');
        const data = await res.json();
        if (data.exito) {
            const contenedor = document.getElementById('listaPedidosCliente');
            contenedor.innerHTML = '';

            const pedidosCliente = data.datos.filter(p => p.cliente && p.cliente.correo === usuarioActual.correo);

            if (pedidosCliente.length === 0) {
                contenedor.innerHTML = '<p style="color:#6b7280; font-size:13px;">No tienes pedidos activos actualmente.</p>';
                return;
            }

            pedidosCliente.forEach(p => {
                const card = document.createElement('div');
                card.className = 'pedido-card';
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <span class="badge">${p.codigo_pedido}</span>
                        <strong style="color:${p.estado === 'Entregado' ? '#059669' : '#d97706'}">${p.estado}</strong>
                    </div>
                    
                    <div class="pin-badge-card">
                        <small>Tu PIN de 4 dígitos para recibir el pedido:</small>
                        <strong>${p.pin_seguridad}</strong>
                    </div>
                    
                    <p style="font-size:12px; color:#4b5563;">
                        Total: <strong>$${p.total.toLocaleString('es-CL')}</strong> | Fecha: ${new Date(p.fecha_pedido).toLocaleDateString()}
                    </p>
                `;
                contenedor.appendChild(card);
            });
        }
    } catch (e) {
        mostrarToast('Error cargando pedidos', 'error');
    }
}

/* =======================================================
   VISTA 2: RESTAURANTE (Crear Platillos y Ver Cocina)
======================================================= */
async function cargarPanelRestaurante() {
    document.getElementById('tituloRestaurante').textContent = `🏪 ${usuarioActual.nombre}`;
    try {
        // Platillos del restaurante
        const resPlat = await fetch('/api/mongo/platillos');
        const dataPlat = await resPlat.json();
        const contenedorPlat = document.getElementById('platillosRestauranteList');
        contenedorPlat.innerHTML = '';

        if (dataPlat.exito && dataPlat.datos.length > 0) {
            dataPlat.datos.forEach(pl => {
                const item = document.createElement('div');
                item.className = 'item-row';
                item.innerHTML = `
                    <strong>${pl.nombre}</strong> (${pl.calorias} kcal) - $${pl.precio.toLocaleString('es-CL')}<br>
                    <small style="color:#059669;">Transparencia: ${pl.indice_transparencia}% | P: ${pl.macronutrientes.proteinas_g}g | C: ${pl.macronutrientes.carbohidratos_g}g | G: ${pl.macronutrientes.grasas_g}g</small>
                `;
                contenedorPlat.appendChild(item);
            });
        }

        // Pedidos
        const resPed = await fetch('/api/mongo/pedidos');
        const dataPed = await resPed.json();
        const contenedorPed = document.getElementById('pedidosCocinaList');
        contenedorPed.innerHTML = '';

        if (dataPed.exito && dataPed.datos.length > 0) {
            dataPed.datos.forEach(p => {
                const item = document.createElement('div');
                item.className = 'item-row';
                item.innerHTML = `
                    <strong>${p.codigo_pedido}</strong> - Cliente: ${p.cliente.nombre} (${p.cliente.telefono})<br>
                    <small>Estado: <span style="color:#d97706; font-weight:600;">${p.estado}</span> | Total: $${p.total.toLocaleString('es-CL')}</small>
                `;
                contenedorPed.appendChild(item);
            });
        } else {
            contenedorPed.innerHTML = '<p>No hay pedidos en cola.</p>';
        }
    } catch (e) {
        mostrarToast('Error al cargar panel restaurante', 'error');
    }
}

// Formulario de Crear Platillo (Restaurante)
document.getElementById('formNuevoPlatillo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const platilloData = {
        nombre: document.getElementById('platoNombre').value,
        descripcion: document.getElementById('platoDescripcion').value,
        precio: parseFloat(document.getElementById('platoPrecio').value),
        calorias: parseInt(document.getElementById('platoCalorias').value),
        proteinas: parseFloat(document.getElementById('platoProteina').value),
        carbos: parseFloat(document.getElementById('platoCarbos').value),
        grasas: parseFloat(document.getElementById('platoGrasas').value),
        indice_transparencia: 96,
        restaurante_id: usuarioActual.id
    };

    try {
        const res = await fetch('/api/mongo/platillos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(platilloData)
        });

        const data = await res.json();
        if (data.exito) {
            mostrarToast('✅ Platillo publicado exitosamente en MongoDB Atlas', 'success');
            document.getElementById('formNuevoPlatillo').reset();
            cargarPanelRestaurante();
        } else {
            mostrarToast(data.mensaje || 'Error al guardar platillo', 'error');
        }
    } catch (err) {
        mostrarToast('Error al registrar platillo', 'error');
    }
});

/* =======================================================
   VISTA 3: REPARTIDOR MOBILE-FIRST
======================================================= */
let pinIngresado = '';
let pedidoAsignadoActual = null;

async function cargarPanelRepartidor() {
    pinIngresado = '';
    actualizarDisplayPin();

    try {
        const res = await fetch('/api/mongo/pedidos');
        const data = await res.json();
        if (data.exito && data.datos.length > 0) {
            // Priorizamos un pedido En Camino o En Preparación
            pedidoAsignadoActual = data.datos.find(p => p.estado === 'En Camino') 
                                || data.datos.find(p => p.estado === 'En Preparación') 
                                || data.datos[0];

            document.getElementById('repartidorCodPedido').textContent = pedidoAsignadoActual.codigo_pedido;
            document.getElementById('repartidorClienteNombre').textContent = `Cliente: ${pedidoAsignadoActual.cliente.nombre}`;
            document.getElementById('repartidorTotalPedido').textContent = `Total: $${pedidoAsignadoActual.total.toLocaleString('es-CL')}`;

            const badge = document.getElementById('repartidorPedidoBadge');
            badge.textContent = pedidoAsignadoActual.estado;

            const btnAceptar = document.getElementById('btnAceptarReparto');
            if (pedidoAsignadoActual.estado === 'En Preparación') {
                btnAceptar.classList.remove('hidden');
                btnAceptar.textContent = '🛵 Aceptar Reparto';
                badge.style.background = '#fef3c7';
                badge.style.color = '#92400e';
            } else if (pedidoAsignadoActual.estado === 'En Camino') {
                btnAceptar.classList.add('hidden');
                badge.style.background = '#dbeafe';
                badge.style.color = '#1e40af';
            } else {
                btnAceptar.classList.add('hidden');
                badge.style.background = '#dcfce7';
                badge.style.color = '#15803d';
            }
        }
    } catch (e) {
        mostrarToast('Error cargando pedidos para entrega', 'error');
    }
}

// Aceptar pedido (pasa a 'En Camino')
async function aceptarPedidoReparto() {
    if (!pedidoAsignadoActual) return;
    try {
        const res = await fetch('/api/mongo/pedidos/aceptar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo_pedido: pedidoAsignadoActual.codigo_pedido,
                repartidor_id: usuarioActual.id
            })
        });

        const data = await res.json();
        if (data.exito) {
            mostrarToast('🛵 ' + data.mensaje, 'success');
            cargarPanelRepartidor();
        } else {
            mostrarToast(data.mensaje || 'No se pudo aceptar el pedido', 'error');
        }
    } catch (e) {
        mostrarToast('Error al aceptar el reparto', 'error');
    }
}

// Teclado PIN
function teclearPin(num) {
    if (pinIngresado.length < 4) {
        pinIngresado += num;
        actualizarDisplayPin();
    }
}

function borrarPin() {
    pinIngresado = pinIngresado.slice(0, -1);
    actualizarDisplayPin();
}

function limpiarPin() {
    pinIngresado = '';
    actualizarDisplayPin();
}

function actualizarDisplayPin() {
    document.getElementById('inputPinPantalla').value = pinIngresado;
}

// Validar PIN de entrega
async function enviarValidacionPin() {
    if (pinIngresado.length !== 4) {
        mostrarToast('Debes ingresar los 4 dígitos del PIN', 'error');
        return;
    }

    try {
        const res = await fetch('/api/mongo/pedidos/validar-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo_pedido: pedidoAsignadoActual ? pedidoAsignadoActual.codigo_pedido : 'KALO-2026-0001',
                pin_ingresado: pinIngresado
            })
        });

        const data = await res.json();

        if (data.exito) {
            mostrarToast('🎉 ' + data.mensaje, 'success');
            limpiarPin();
            cargarPanelRepartidor();
        } else {
            mostrarToast('❌ ' + data.mensaje, 'error');
            limpiarPin();
        }
    } catch (e) {
        mostrarToast('Error de conexión al validar PIN', 'error');
    }
}

/* =======================================================
   VISTA 4: CONSOLA NoSQL (EVALUACIÓN DOCENTE)
======================================================= */
function abrirModalNoSQL() {
    document.getElementById('modalNoSQL').classList.remove('hidden');
}

function cerrarModalNoSQL() {
    document.getElementById('modalNoSQL').classList.add('hidden');
}

async function ejecutarConsultaMQL(url, metodo) {
    const queryDisplay = document.getElementById('mqlQueryDisplay');
    const jsonDisplay = document.getElementById('mqlJsonDisplay');
    const tagOperacion = document.getElementById('mqlOperacionTag');
    const tagStatus = document.getElementById('mqlStatusTag');

    queryDisplay.textContent = 'Ejecutando consulta en MongoDB Atlas...';
    jsonDisplay.textContent = 'Cargando respuesta...';
    tagStatus.textContent = 'Estado: Consultando...';

    try {
        const res = await fetch(url, { method: metodo });
        const data = await res.json();

        tagOperacion.textContent = `Operación: ${data.operacion || 'Consulta NoSQL'}`;
        tagStatus.textContent = `Estado: HTTP ${res.status} OK`;
        queryDisplay.textContent = data.consultaMQL || '// Consulta estándar';
        jsonDisplay.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
        tagStatus.textContent = 'Estado: Error';
        jsonDisplay.textContent = e.message;
    }
}
