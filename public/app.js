/**
 * ==========================================================================
 * KALO - LÓGICA DE APLICACIÓN FRONTEND
 * Alineada rigurosamente a los mockups oficiales (ICI324 / Desarrollo Web)
 * ==========================================================================
 */

// ESTADO GLOBAL DE LA APLICACIÓN
let usuarioActual = {
    id: "6620f1a4e13b8a1c90000001",
    nombre: "Andrea Gómez",
    correo: "andrea@mail.com",
    rol: "cliente",
    perfil_biometrico: {
        peso_kg: 68.5,
        altura_m: 1.65,
        edad: 28,
        genero: "Femenino",
        imc: 25.2,
        meta_calorica_diaria: 1800,
        objetivo_salud: "Nutrición balanceada"
    }
};

let caloriasConsumidasHoy = 1080; // Estado base del mockup ("Has consumido 1.080 de 1.800 kcal hoy")
let platillosGlobales = [];
let platilloSeleccionadoFicha = null;
let cantidadFicha = 1;
let carrito = [];
let pedidosGlobales = [];
let pedidoSeguimientoActual = null;
let pedidoParaDespacharCodigo = null;
let pinRepartidorActual = '';

// Filtros de búsqueda
let filtros = {
    momento: 'Almuerzo',
    busqueda: '',
    maxCalorias: 600,
    solo600: false,
    altoProteina: false,
    bajoCarbos: false,
    precioMax: 10000,
    solo100Transp: false
};

// ==========================================================================
// 1. INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        cargarPlatillosDesdeServidor();
        cargarPedidosCliente();
        actualizarBarraCaloriasGlobal();
    } catch (err) {
        console.warn('Error en inicialización:', err);
    }

    // Inicializar listener de login de forma segura
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', procesarLogin);
    }
});

// Toast de notificación
function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.className = `toast toast-${tipo}`;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// ==========================================================================
// 2. CONTROL DE VISTAS PRINCIPALES & ONBOARDING (MOCKUP 1)
// ==========================================================================
function ocultarTodasLasVistasPrincipales() {
    document.getElementById('seccionOnboarding').classList.add('hidden');
    document.getElementById('seccionCliente').classList.add('hidden');
    document.getElementById('seccionRestaurante').classList.add('hidden');
    document.getElementById('seccionRepartidor').classList.add('hidden');
}

function mostrarPantallaOnboarding(pantallaId) {
    ocultarTodasLasVistasPrincipales();
    document.getElementById('seccionOnboarding').classList.remove('hidden');

    const pantallas = [
        'pantallaBienvenida',
        'pantallaLogin',
        'pantallaRegistroPaso1',
        'pantallaRegistroPaso2',
        'pantallaResultadoIMC'
    ];

    pantallas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    if (pantallaId === 'bienvenida') document.getElementById('pantallaBienvenida').classList.remove('hidden');
    else if (pantallaId === 'login') document.getElementById('pantallaLogin').classList.remove('hidden');
    else if (pantallaId === 'registro1') document.getElementById('pantallaRegistroPaso1').classList.remove('hidden');
    else if (pantallaId === 'registro2') document.getElementById('pantallaRegistroPaso2').classList.remove('hidden');
    else if (pantallaId === 'resultadoIMC') document.getElementById('pantallaResultadoIMC').classList.remove('hidden');
}

// Toggle Mostrar/Ocultar contraseña con icono
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '👁 Ocultar';
    } else {
        input.type = 'password';
        btn.textContent = '👁 Mostrar';
    }
}

// Validación de contraseña en tiempo real
function validarRegPassword(pass) {
    const chkLen = document.getElementById('chkPassLength');
    const chkComp = document.getElementById('chkPassComplexity');

    if (pass.length >= 8) {
        chkLen.textContent = '✓ Al menos 8 caracteres';
        chkLen.className = 'chk-item valid';
    } else {
        chkLen.textContent = '◻ Al menos 8 caracteres';
        chkLen.className = 'chk-item';
    }

    const tieneMayus = /[A-Z]/.test(pass);
    const tieneNum = /[0-9]/.test(pass);
    if (tieneMayus && tieneNum) {
        chkComp.textContent = '✓ Una mayúscula y un número';
        chkComp.className = 'chk-item valid';
    } else {
        chkComp.textContent = '◻ Una mayúscula y un número';
        chkComp.className = 'chk-item';
    }
}

// Validación de altura (1.00m a 2.50m según mockup)
function validarAltura(input) {
    const val = parseFloat(input.value);
    const errorEl = document.getElementById('errorAltura');
    if (val < 1.0 || val > 2.5) {
        input.classList.add('has-error');
        errorEl.classList.remove('hidden');
    } else {
        input.classList.remove('has-error');
        errorEl.classList.add('hidden');
    }
}

// Selector visual de rol en registro
let rolRegistroSeleccionado = 'cliente';
function seleccionarRolRegistro(rol) {
    rolRegistroSeleccionado = rol === 'comprador' ? 'cliente' : rol;
    
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.role-check').forEach(k => k.textContent = '◻');

    if (rol === 'comprador') {
        const c = document.getElementById('cardRolComprador');
        c.classList.add('selected');
        c.querySelector('.role-check').textContent = '✓';
    } else if (rol === 'restaurante') {
        const c = document.getElementById('cardRolRestaurante');
        c.classList.add('selected');
        c.querySelector('.role-check').textContent = '✓';
    } else if (rol === 'repartidor') {
        const c = document.getElementById('cardRolRepartidor');
        c.classList.add('selected');
        c.querySelector('.role-check').textContent = '✓';
    }

    // Mostrar / ocultar campos extra según rol
    const camposRest = document.getElementById('camposRestaurante');
    const camposRep  = document.getElementById('camposRepartidor');
    const btnContinuar = document.getElementById('btnContinuarRegistro');

    camposRest.classList.add('hidden');
    camposRep.classList.add('hidden');

    if (rolRegistroSeleccionado === 'restaurante') {
        camposRest.classList.remove('hidden');
        if (btnContinuar) btnContinuar.textContent = 'Crear restaurante';
    } else if (rolRegistroSeleccionado === 'repartidor') {
        camposRep.classList.remove('hidden');
        if (btnContinuar) btnContinuar.textContent = 'Registrarme como repartidor';
    } else {
        if (btnContinuar) btnContinuar.textContent = 'Continuar';
    }
}

function avanzarRegistroPaso2(e) {
    e.preventDefault();
    if (rolRegistroSeleccionado !== 'cliente') {
        // Restaurante o repartidor se crean directamente con sus campos extra
        finalizarRegistro(e);
        return;
    }
    mostrarPantallaOnboarding('registro2');
}

// Finalizar registro de usuario y calcular IMC
async function finalizarRegistro(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nombre = document.getElementById('regNombre').value.trim();
    const correo = document.getElementById('regCorreo').value.trim();
    const password = document.getElementById('regPassword').value;

    // Campos extra según rol
    const especialidad = document.getElementById('regRestEspecialidad')?.value?.trim() || '';
    const direccion    = document.getElementById('regRestDireccion')?.value?.trim() || '';
    const telefonoRest = document.getElementById('regRestTelefono')?.value?.trim() || '';
    const telefonoRep  = document.getElementById('regRepTelefono')?.value?.trim() || '';
    const vehiculo     = document.getElementById('regRepVehiculo')?.value || 'Motocicleta';

    // Biométricos (solo para cliente; para otros roles se ponen defaults)
    const peso   = parseFloat(document.getElementById('regPeso')?.value) || 68.5;
    const altura = parseFloat(document.getElementById('regAltura')?.value) || 1.65;
    const edad   = parseInt(document.getElementById('regEdad')?.value) || 28;
    const genero = document.getElementById('regGenero')?.value || 'Femenino';

    if (!nombre || !correo || !password) {
        mostrarToast('Por favor completa nombre, correo y contraseña', 'error');
        return;
    }

    // Validar campos obligatorios según rol
    if (rolRegistroSeleccionado === 'restaurante' && !especialidad) {
        mostrarToast('Ingresa la especialidad del restaurante', 'error');
        return;
    }
    if (rolRegistroSeleccionado === 'restaurante' && !direccion) {
        mostrarToast('Ingresa la dirección del restaurante', 'error');
        return;
    }

    try {
        const body = {
            rol: rolRegistroSeleccionado,
            nombre, correo, password, peso, altura, edad, genero,
            // Campos extra restaurante
            especialidad: especialidad || 'Comida Nutritiva y Saludable',
            direccion: direccion || 'Valparaíso, Chile',
            telefono: rolRegistroSeleccionado === 'restaurante' ? telefonoRest : telefonoRep,
            vehiculo
        };

        const res = await fetch('/api/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (data.exito) {
            usuarioActual = data.usuario;
            if (rolRegistroSeleccionado === 'cliente') {
                const imc = (peso / (altura * altura)).toFixed(1);
                document.getElementById('resultadoNombreUsuario').textContent = nombre;
                document.getElementById('resImcValor').textContent = imc.replace('.', ',');
                document.getElementById('resPesoTag').textContent = `${peso} kg`;
                document.getElementById('resAlturaTag').textContent = `${altura} m`;
                document.getElementById('resEdadTag').textContent = `${edad} años`;
                
                let diag = '• Peso saludable';
                if (imc >= 25 && imc < 30) diag = '• Sobrepeso leve';
                else if (imc >= 30) diag = '• Obesidad';
                document.getElementById('resImcDiagnostico').textContent = diag;

                const meta = usuarioActual.perfil_biometrico?.meta_calorica_diaria || 1800;
                document.getElementById('resMetaCalorica').textContent = `${meta.toLocaleString('es-CL')} kcal/día`;

                mostrarPantallaOnboarding('resultadoIMC');
            } else if (rolRegistroSeleccionado === 'restaurante') {
                mostrarToast(`✅ Restaurante "${nombre}" registrado exitosamente`, 'success');
                iniciarSesionRestaurante(usuarioActual);
            } else {
                mostrarToast(`✅ Repartidor "${nombre}" registrado exitosamente`, 'success');
                iniciarSesionRepartidor(usuarioActual);
            }
        } else {
            mostrarToast(data.mensaje || 'No se pudo crear la cuenta', 'error');
        }
    } catch (err) {
        mostrarToast('Error de conexión al registrar: ' + err.message, 'error');
    }
}

// Proceso de Login
async function procesarLogin(e) {
    e.preventDefault();
    const correo = document.getElementById('loginCorreo').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const alertError = document.getElementById('loginErrorAlert');
    const inputPass = document.getElementById('loginPassword');

    alertError.classList.add('hidden');
    inputPass.classList.remove('has-error');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password })
        });

        const data = await res.json();
        if (data.exito) {
            usuarioActual = data.usuario;
            mostrarToast(`¡Bienvenido(a), ${usuarioActual.nombre}!`, 'success');
            
            if (usuarioActual.rol === 'cliente') {
                iniciarExploracionComprador();
            } else if (usuarioActual.rol === 'restaurante') {
                iniciarSesionRestaurante(usuarioActual);
            } else if (usuarioActual.rol === 'repartidor') {
                iniciarSesionRepartidor(usuarioActual);
            }
        } else {
            // Mostrar error idéntico al Mockup 1.3
            alertError.classList.remove('hidden');
            inputPass.classList.add('has-error');
        }
    } catch (err) {
        mostrarToast('Error de conexión con el servidor', 'error');
    }
}

function cerrarSesion() {
    usuarioActual = null;
    mostrarPantallaOnboarding('bienvenida');
    mostrarToast('Sesión cerrada correctamente', 'success');
}

// ==========================================================================
// 3. INICIO DE SESIÓN Y VISTAS ESPECÍFICAS POR ROL
// ==========================================================================

// Iniciar sesión y poblar UI para Restaurante dinámico
function iniciarSesionRestaurante(usuario) {
    usuarioActual = usuario;
    ocultarTodasLasVistasPrincipales();
    document.getElementById('seccionRestaurante').classList.remove('hidden');

    actualizarInterfazRestaurante(usuario);
    cambiarTabRestaurante('pedidos');
    cargarTablaPlatillosRestaurante();
    cargarEvaluacionesRestaurante();
    cargarRepartidoresEnSelect();
    mostrarToast(`Sesión activa: ${usuario.nombre} (Restaurante)`, 'success');
}

function actualizarInterfazRestaurante(usuario) {
    if (!usuario) return;
    const lblSide = document.getElementById('lblSideNombreRestaurante');
    if (lblSide) lblSide.textContent = usuario.nombre || 'Restaurante Kalo';

    const lblTop = document.getElementById('lblTopRestauranteNombre');
    if (lblTop) lblTop.textContent = `${usuario.nombre} · ${usuario.direccion || usuario.especialidad || 'Cocina Certificada'}`;

    const inputNombre = document.getElementById('inputRestNombreLocal');
    if (inputNombre) inputNombre.value = usuario.nombre || '';

    const inputDir = document.getElementById('inputRestDireccion');
    if (inputDir) inputDir.value = usuario.direccion || '';

    const inputTel = document.getElementById('inputRestTelefono');
    if (inputTel) inputTel.value = usuario.telefono || '';

    const inputEsp = document.getElementById('inputRestEspecialidad');
    if (inputEsp) inputEsp.value = usuario.especialidad || '';
}

// Guardar cambios de "Mi Local" en MongoDB Atlas
async function guardarDatosMiLocal() {
    if (!usuarioActual || usuarioActual.rol !== 'restaurante') {
        mostrarToast('Debes haber iniciado sesión como restaurante', 'error');
        return;
    }
    const nombre = document.getElementById('inputRestNombreLocal').value.trim();
    const direccion = document.getElementById('inputRestDireccion').value.trim();
    const telefono = document.getElementById('inputRestTelefono').value.trim();
    const especialidad = document.getElementById('inputRestEspecialidad').value.trim();

    try {
        const res = await fetch('/api/mongo/restaurantes/mi-local', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                restaurante_id: usuarioActual.id,
                nombre, direccion, telefono, especialidad
            })
        });
        const data = await res.json();
        if (data.exito) {
            usuarioActual.nombre = nombre;
            usuarioActual.direccion = direccion;
            usuarioActual.telefono = telefono;
            usuarioActual.especialidad = especialidad;
            actualizarInterfazRestaurante(usuarioActual);
            mostrarToast('✅ Datos del local actualizados en MongoDB Atlas', 'success');
        } else {
            mostrarToast(data.mensaje || 'Error al guardar', 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión al actualizar local', 'error');
    }
}

// Iniciar sesión y poblar UI para Repartidor dinámico
function iniciarSesionRepartidor(usuario) {
    usuarioActual = usuario;
    ocultarTodasLasVistasPrincipales();
    document.getElementById('seccionRepartidor').classList.remove('hidden');

    const repNom = document.getElementById('repNombreHeader');
    if (repNom) repNom.textContent = `🛵 ${usuario.nombre}`;

    const repVehiculo = document.getElementById('repInfoVehiculo');
    if (repVehiculo) {
        repVehiculo.textContent = `Vehículo: ${usuario.vehiculo || 'Motocicleta'} · Tel: ${usuario.telefono || '+569...'}`;
    }

    cargarPedidoRepartidor();
    mostrarToast(`Sesión activa: ${usuario.nombre} (Repartidor)`, 'success');
}

// Accesos Demo rápidos
function activarDemoCliente() {
    usuarioActual = {
        id: "6620f1a4e13b8a1c90000001",
        nombre: "Andrea Gómez",
        correo: "andrea@mail.com",
        rol: "cliente",
        perfil_biometrico: {
            peso_kg: 68.5,
            altura_m: 1.65,
            edad: 28,
            genero: "Femenino",
            imc: 25.2,
            meta_calorica_diaria: 1800,
            objetivo_salud: "Nutrición balanceada"
        }
    };
    iniciarExploracionComprador();
    mostrarToast('Sesión activa: Andrea Gómez (Cliente)', 'success');
}

function activarDemoRestaurante() {
    iniciarSesionRestaurante({
        id: "6620f1a4e13b8a1c90000010",
        nombre: "Verde Vivo",
        correo: "contacto@verdevivo.cl",
        rol: "restaurante",
        especialidad: "Comida saludable y bowls funcionales",
        direccion: "Av. Providencia 1240, Providencia, Santiago",
        telefono: "+569 8765 4321",
        calificacion_promedio: 4.9
    });
}

function activarDemoRepartidor() {
    iniciarSesionRepartidor({
        id: "6620f1a4e13b8a1c90000020",
        nombre: "Carlos Repartidor",
        correo: "carlos.reparto@kalo.cl",
        rol: "repartidor",
        telefono: "+569 6611 2233",
        vehiculo: "Motocicleta",
        estado: "Disponible",
        calificacion: 5.0
    });
}

// Iniciar aplicación móvil del comprador
function iniciarExploracionComprador() {
    ocultarTodasLasVistasPrincipales();
    document.getElementById('seccionCliente').classList.remove('hidden');
    irATabCliente('explorar');
    actualizarDatosPerfilVista();
    actualizarBarraCaloriasGlobal();
}

// ==========================================================================
// 4. CLIENTE / COMPRADOR (MOCKUP 2, 3, 4)
// ==========================================================================
function irATabCliente(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    if (tabName === 'explorar') {
        document.getElementById('tabExplorar').classList.remove('hidden');
        document.getElementById('btnNavExplorar').classList.add('active');
    } else if (tabName === 'pedidos') {
        document.getElementById('tabPedidos').classList.remove('hidden');
        document.getElementById('btnNavPedidos').classList.add('active');
        cargarPedidosCliente();
    } else if (tabName === 'carrito') {
        document.getElementById('tabCarrito').classList.remove('hidden');
        document.getElementById('btnNavCarrito').classList.add('active');
        renderizarCarrito();
    } else if (tabName === 'perfil') {
        document.getElementById('tabPerfil').classList.remove('hidden');
        document.getElementById('btnNavPerfil').classList.add('active');
        actualizarDatosPerfilVista();
    }
}

// Actualizar Barra Calórica Diaria Global
function actualizarBarraCaloriasGlobal() {
    const meta = usuarioActual?.perfil_biometrico?.meta_calorica_diaria || 1800;
    const porcentaje = Math.min(Math.round((caloriasConsumidasHoy / meta) * 100), 100);

    const lblConsumo = document.getElementById('lblConsumoKcal');
    const lblMeta = document.getElementById('lblMetaKcal');
    const bar = document.getElementById('trackerBarFill');

    if (lblConsumo) lblConsumo.textContent = caloriasConsumidasHoy.toLocaleString('es-CL');
    if (lblMeta) lblMeta.textContent = meta.toLocaleString('es-CL');
    if (bar) bar.style.width = `${porcentaje}%`;
}

// Cargar catálogo de platillos desde Atlas
async function cargarPlatillosDesdeServidor() {
    try {
        const res = await fetch('/api/mongo/platillos');
        const data = await res.json();
        if (data.exito && data.datos) {
            platillosGlobales = data.datos;
            aplicarFiltrosYRenderizar();
        }
    } catch (e) {
        console.warn('Usando catálogo local:', e.message);
    }
}

// Renderizar platillos en la lista vertical
function aplicarFiltrosYRenderizar() {
    const contenedor = document.getElementById('gridPlatillosMobile');
    const estadoVacio = document.getElementById('estadoSinResultados');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    let filtrados = platillosGlobales.filter(p => {
        // Filtro por búsqueda de texto
        if (filtros.busqueda && !p.nombre.toLowerCase().includes(filtros.busqueda.toLowerCase())) {
            return false;
        }
        // Filtro por momento del día (categoría)
        if (filtros.momento && p.categoria && p.categoria !== filtros.momento) {
            // Permitir platos sin categoría explícita como Almuerzo
            if (filtros.momento !== 'Almuerzo' && (!p.categoria || p.categoria === 'Almuerzo')) return false;
        }
        // Filtro <= 600 kcal
        if (filtros.solo600 && p.calorias > 600) return false;
        // Filtro slider kcal
        if (filtros.maxCalorias && p.calorias > filtros.maxCalorias) return false;
        // Filtro alto en proteínas (>= 30g)
        if (filtros.altoProteina && (p.macronutrientes?.proteinas_g || 0) < 30) return false;
        // Filtro bajo en carbohidratos (<= 35g)
        if (filtros.bajoCarbos && (p.macronutrientes?.carbohidratos_g || 0) > 35) return false;
        // Filtro precio máximo
        if (filtros.precioMax && p.precio > filtros.precioMax) return false;
        // Filtro 100% transparencia
        if (filtros.solo100Transp && (p.indice_transparencia || 0) < 95) return false;

        return true;
    });

    if (filtrados.length === 0) {
        estadoVacio.classList.remove('hidden');
        return;
    }

    estadoVacio.classList.add('hidden');

    filtrados.forEach(plato => {
        const card = document.createElement('div');
        card.className = 'dish-card-mobile';
        card.onclick = () => abrirModalFichaPlatillo(plato._id);

        const imgUrl = plato.imagen_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';
        const prot = plato.macronutrientes?.proteinas_g || 38;
        const carb = plato.macronutrientes?.carbohidratos_g || 45;
        const gras = plato.macronutrientes?.grasas_g || 18;
        const restNombre = plato.restaurante_id?.nombre || 'Verde Vivo';
        const restDireccion = plato.restaurante_id?.direccion || 'Valparaíso';

        card.innerHTML = `
            <div class="dish-card-img-wrap">
                <img src="${imgUrl}" alt="${plato.nombre}">
                <span class="badge-transparency-card">✓ Relata ${plato.indice_transparencia || 100}% transparente</span>
            </div>
            <div class="dish-card-body">
                <h4>${plato.nombre}</h4>
                <span class="dish-card-rest-name">${restNombre} · ${restDireccion}</span>
                <span class="dish-calorie-pill">${plato.calorias} Kcal / porción</span>
                
                <div class="dish-macros-pills">
                    <span>P: <strong>${prot}g</strong></span>
                    <span>C: <strong>${carb}g</strong></span>
                    <span>G: <strong>${gras}g</strong></span>
                </div>

                <div class="dish-card-footer">
                    <span class="dish-price">$${plato.precio.toLocaleString('es-CL')}</span>
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); agregarDirectoAlCarrito('${plato._id}')">
                        + Agregar
                    </button>
                </div>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

// Búsqueda en vivo
function filtrarPlatillosEnVivo() {
    filtros.busqueda = document.getElementById('inputBuscarPlatillos').value.trim();
    aplicarFiltrosYRenderizar();
}

// Filtrar momento del día
function filtrarMomentoDia(momento, btn) {
    document.querySelectorAll('.pill-category').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtros.momento = momento;
    aplicarFiltrosYRenderizar();
}

// Filtro rápido <= 600 kcal
function toggleFiltroRapido600(btn) {
    filtros.solo600 = !filtros.solo600;
    btn.classList.toggle('active', filtros.solo600);
    aplicarFiltrosYRenderizar();
}

// Filtro rápido Alto en proteínas
function toggleFiltroRapidoProteina(btn) {
    filtros.altoProteina = !filtros.altoProteina;
    btn.classList.toggle('active', filtros.altoProteina);
    aplicarFiltrosYRenderizar();
}

function limpiarTodosFiltros() {
    filtros = {
        momento: 'Almuerzo',
        busqueda: '',
        maxCalorias: 1000,
        solo600: false,
        altoProteina: false,
        bajoCarbos: false,
        precioMax: 15000,
        solo100Transp: false
    };
    document.getElementById('inputBuscarPlatillos').value = '';
    document.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
    cerrarModalFiltrosAvanzados();
    aplicarFiltrosYRenderizar();
}

// ==========================================================================
// 4.1 FICHA DEL PLATILLO & INGREDIENTES (MOCKUP 2.5)
// ==========================================================================
function abrirModalFichaPlatillo(id) {
    const plato = platillosGlobales.find(p => p._id === id);
    if (!plato) return;

    platilloSeleccionadoFicha = plato;
    cantidadFicha = 1;

    document.getElementById('sheetPlatoNombre').textContent = plato.nombre;
    document.getElementById('sheetPlatoPrecio').textContent = `$${plato.precio.toLocaleString('es-CL')}`;
    document.getElementById('sheetPlatoKcal').textContent = plato.calorias;
    document.getElementById('sheetPlatoProt').textContent = `${plato.macronutrientes?.proteinas_g || 38} g`;
    document.getElementById('sheetPlatoCarb').textContent = `${plato.macronutrientes?.carbohidratos_g || 45} g`;
    document.getElementById('sheetPlatoGras').textContent = `${plato.macronutrientes?.grasas_g || 18} g`;
    document.getElementById('sheetPlatoImg').src = plato.imagen_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80';
    document.getElementById('sheetPlatoTransp').textContent = `Índice de Transparencia ${plato.indice_transparencia || 100}/100`;

    // Render de ingredientes sin letra chica
    const contenedorIng = document.getElementById('sheetListaIngredientes');
    contenedorIng.innerHTML = '';
    const listaIng = (plato.ingredientes && plato.ingredientes.length > 0) ? plato.ingredientes : [
        { nombre: 'Salmón fresco', cantidad_g: 150, metodo_coccion: 'a la plancha' },
        { nombre: 'Quinoa real orgánica', cantidad_g: 100, metodo_coccion: 'cocida al vapor' },
        { nombre: 'Palta Hass', cantidad_g: 50, metodo_coccion: 'fresca en láminas' },
        { nombre: 'Pepino y mix verde', cantidad_g: 80, metodo_coccion: 'fresco sin preservantes' }
    ];

    listaIng.forEach(ing => {
        const div = document.createElement('div');
        div.className = 'ing-item-line';
        div.innerHTML = `<span>${ing.nombre} ${ing.cantidad_g ? ing.cantidad_g + ' g' : ''}</span> <small>${ing.metodo_coccion}</small>`;
        contenedorIng.appendChild(div);
    });

    actualizarSubtotalFicha();
    document.getElementById('modalFichaPlatillo').classList.remove('hidden');
}

function cerrarModalFichaPlatillo() {
    document.getElementById('modalFichaPlatillo').classList.add('hidden');
}

function modificarCantidadFicha(delta) {
    cantidadFicha += delta;
    if (cantidadFicha < 1) cantidadFicha = 1;
    actualizarSubtotalFicha();
}

function actualizarSubtotalFicha() {
    document.getElementById('sheetCantidadNum').textContent = cantidadFicha;
    const total = (platilloSeleccionadoFicha?.precio || 8990) * cantidadFicha;
    document.getElementById('sheetBtnPrecioTotal').textContent = `$${total.toLocaleString('es-CL')}`;
}

function agregarAlCarritoDesdeFicha() {
    if (!platilloSeleccionadoFicha) return;
    agregarItemAlCarrito(platilloSeleccionadoFicha, cantidadFicha);
    cerrarModalFichaPlatillo();
    mostrarToast(`Agregaste ${cantidadFicha}x "${platilloSeleccionadoFicha.nombre}"`, 'success');
}

function agregarDirectoAlCarrito(id) {
    const plato = platillosGlobales.find(p => p._id === id);
    if (!plato) return;
    agregarItemAlCarrito(plato, 1);
    mostrarToast(`Agregaste "${plato.nombre}" al carrito`, 'success');
}

let itemPendienteCambioRestaurante = null;

function agregarItemAlCarrito(plato, cantidad) {
    const rId = String(plato.restaurante_id?._id || plato.restaurante_id || '');
    const rNom = plato.restaurante_id?.nombre || 'Verde Vivo';

    // Regla de negocio Delivery: El carrito solo puede contener platillos de 1 restaurante
    if (carrito.length > 0) {
        const restActualId = String(carrito[0].restaurante_id || '');
        const restActualNom = carrito[0].restaurante_nombre || 'otro restaurante';

        if (restActualId && rId && restActualId !== rId) {
            itemPendienteCambioRestaurante = { plato, cantidad, rId, rNom };
            const textoEl = document.getElementById('lblTextoCambioRestaurante');
            if (textoEl) {
                textoEl.innerHTML = `Tu carrito actual contiene platillos de <strong>${restActualNom}</strong>.<br><br>Solo puedes pedir a un restaurante a la vez en Kalo. ¿Deseas vaciar tu carrito para pedir a <strong>${rNom}</strong>?`;
            }
            document.getElementById('modalCambioRestauranteCarrito')?.classList.remove('hidden');
            return;
        }
    }

    insertarItemEnCarrito(plato, cantidad, rId, rNom);
}

function cancelarCambioRestauranteCarrito() {
    itemPendienteCambioRestaurante = null;
    document.getElementById('modalCambioRestauranteCarrito')?.classList.add('hidden');
}

function confirmarCambioRestauranteCarrito() {
    document.getElementById('modalCambioRestauranteCarrito')?.classList.add('hidden');
    if (itemPendienteCambioRestaurante) {
        carrito = []; // Vaciar carrito de otro restaurante
        const { plato, cantidad, rId, rNom } = itemPendienteCambioRestaurante;
        itemPendienteCambioRestaurante = null;
        insertarItemEnCarrito(plato, cantidad, rId, rNom);
        mostrarToast(`Carrito reiniciado. Ahora pides en "${rNom}"`, 'info');
    }
}

function insertarItemEnCarrito(plato, cantidad, rId, rNom) {
    const item = carrito.find(it => it.platillo_id === plato._id);
    if (item) {
        item.cantidad += cantidad;
    } else {
        carrito.push({
            platillo_id: plato._id,
            nombre: plato.nombre,
            precio: plato.precio,
            calorias: plato.calorias,
            imagen_url: plato.imagen_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=150&q=80',
            restaurante_id: rId,
            restaurante_nombre: rNom,
            cantidad
        });
    }
    actualizarBadgeCarrito();
}

function actualizarBadgeCarrito() {
    const total = carrito.reduce((sum, it) => sum + it.cantidad, 0);
    const badge = document.getElementById('badgeContadorCarrito');
    if (badge) badge.textContent = total;
}

// ==========================================================================
// 4.2 CARRITO NUTRICIONAL (MOCKUP 2.6)
// ==========================================================================
function renderizarCarrito() {
    const contenedor = document.getElementById('cartItemsList');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (carrito.length === 0) {
        contenedor.innerHTML = '<p class="text-subtle text-center py-4">Tu carrito nutricional está vacío.</p>';
        document.getElementById('cartKcalTotal').textContent = '0 kcal';
        document.getElementById('cartSubtotal').textContent = '$0';
        document.getElementById('cartTotalFinal').textContent = '$0';
        document.getElementById('lblBtnPagar').textContent = '$0';
        return;
    }

    // Cabecera indicando el restaurante único del pedido
    const bannerRest = document.createElement('div');
    bannerRest.style.cssText = 'display:flex; align-items:center; gap:8px; background:#e8f5e9; border:1px solid #c8e6c9; padding:8px 12px; border-radius:8px; margin-bottom:12px; font-size:0.82rem; color:#1b5e3a; font-weight:600;';
    bannerRest.innerHTML = `<span>🏪 Pedido para:</span> <strong>${carrito[0].restaurante_nombre || 'Restaurante Kalo'}</strong>`;
    contenedor.appendChild(bannerRest);

    let subtotal = 0;
    let totalKcal = 0;

    carrito.forEach((item, index) => {
        subtotal += item.precio * item.cantidad;
        totalKcal += item.calorias * item.cantidad;

        const row = document.createElement('div');
        row.className = 'cart-item-card';
        row.innerHTML = `
            <img src="${item.imagen_url}" alt="${item.nombre}" class="dish-thumb-sm">
            <div class="cart-item-info">
                <h5>${item.nombre}</h5>
                <small class="text-subtle">${item.restaurante_nombre || 'Restaurante'} · $${item.precio.toLocaleString('es-CL')} · ${item.calorias} kcal</small>
            </div>
            <div class="qty-counter-row">
                <button class="btn-qty" onclick="cambiarCantidadCarrito(${index}, -1)">-</button>
                <span>${item.cantidad}</span>
                <button class="btn-qty" onclick="cambiarCantidadCarrito(${index}, 1)">+</button>
            </div>
        `;
        contenedor.appendChild(row);
    });

    const costoEnvio = 1490;
    const totalFinal = subtotal + costoEnvio;
    const metaDiaria = usuarioActual?.perfil_biometrico?.meta_calorica_diaria || 1800;
    const metaRestante = metaDiaria - (caloriasConsumidasHoy + totalKcal);

    document.getElementById('cartKcalTotal').textContent = `${totalKcal} kcal`;
    document.getElementById('cartSubtotal').textContent = `$${subtotal.toLocaleString('es-CL')}`;
    document.getElementById('cartTotalFinal').textContent = `$${totalFinal.toLocaleString('es-CL')}`;
    document.getElementById('lblBtnPagar').textContent = `$${totalFinal.toLocaleString('es-CL')}`;

    // Desglose del Impacto Nutricional
    const badgeRestante = document.getElementById('cartMetaRestante');
    if (metaRestante >= 0) {
        badgeRestante.textContent = `✓ Te quedarán ${metaRestante} kcal de tu meta`;
        badgeRestante.style.color = 'var(--kalo-green-primary)';
    } else {
        badgeRestante.textContent = `⚠️ Superarás tu meta por ${Math.abs(metaRestante)} kcal`;
        badgeRestante.style.color = 'var(--kalo-red-danger)';
    }

    document.getElementById('cartEscenarioTexto').textContent = 
        `Escenario de este carrito: ${caloriasConsumidasHoy} kcal consumidas antes + ${totalKcal} kcal = ${caloriasConsumidasHoy + totalKcal} de ${metaDiaria} kcal.`;
}

function cambiarCantidadCarrito(idx, delta) {
    carrito[idx].cantidad += delta;
    if (carrito[idx].cantidad <= 0) {
        carrito.splice(idx, 1);
    }
    actualizarBadgeCarrito();
    renderizarCarrito();
}

// PROCESAR COMPRA EN MONGODB ATLAS Y AVANZAR AL SEGUIMIENTO (MOCKUP 3)
async function procesarPagoCarrito() {
    if (carrito.length === 0) {
        mostrarToast('Agrega al menos un platillo al carrito', 'error');
        return;
    }

    try {
        const subtotal = carrito.reduce((sum, it) => sum + (it.precio * it.cantidad), 0);
        const total = subtotal + 1490;
        const restIdDetectado = carrito[0]?.restaurante_id;

        const res = await fetch('/api/mongo/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario_id: usuarioActual.id,
                items: carrito,
                restaurante_id: restIdDetectado,
                total
            })
        });

        const data = await res.json();
        if (data.exito) {
            pedidoSeguimientoActual = data.pedido;
            carrito = [];
            actualizarBadgeCarrito();
            mostrarToast('🎉 ¡Pago confirmado! Pedido en preparación.', 'success');
            
            // Abrir pestaña de pedidos en la vista de seguimiento del nuevo pedido
            irATabCliente('pedidos');
            renderizarVistaSeguimientoPedido(pedidoSeguimientoActual);
        } else {
            mostrarToast(data.mensaje, 'error');
        }
    } catch (e) {
        mostrarToast('Error al registrar pedido', 'error');
    }
}

// ==========================================================================
// 4.3 SEGUIMIENTO DE PEDIDOS CON STEPPER Y PIN (MOCKUP 3)
// ==========================================================================
async function cargarPedidosCliente() {
    try {
        const res = await fetch('/api/mongo/pedidos');
        const data = await res.json();
        if (data.exito && data.datos) {
            pedidosGlobales = data.datos;
            
            const contenedor = document.getElementById('listaGeneralPedidos');
            const estadoVacio = document.getElementById('pedidosEstadoVacio');
            contenedor.innerHTML = '';

            const pedidosCliente = pedidosGlobales.filter(p => p.cliente && p.cliente.correo === usuarioActual.correo);

            if (pedidosCliente.length === 0 && !pedidoSeguimientoActual) {
                estadoVacio.classList.remove('hidden');
                document.getElementById('panelSeguimientoPedido').classList.add('hidden');
                return;
            }

            estadoVacio.classList.add('hidden');

            if (!pedidoSeguimientoActual && pedidosCliente.length > 0) {
                pedidoSeguimientoActual = pedidosCliente[0];
            }

            if (pedidoSeguimientoActual) {
                renderizarVistaSeguimientoPedido(pedidoSeguimientoActual);
            }

            // Lista histórica inferior
            pedidosCliente.forEach(p => {
                const item = document.createElement('div');
                item.className = 'cart-item-card';
                item.style.cursor = 'pointer';
                item.onclick = () => renderizarVistaSeguimientoPedido(p);
                item.innerHTML = `
                    <div style="flex:1;">
                        <strong>${p.codigo_pedido}</strong> - <small>${new Date(p.fecha_pedido).toLocaleDateString()}</small><br>
                        <small class="text-subtle">${p.detalles?.[0]?.nombre_platillo || 'Bowl nutritivo'} · Total: $${p.total.toLocaleString('es-CL')}</small>
                    </div>
                    <span class="badge-mini" style="font-weight:700; color:${p.estado === 'Entregado' ? '#059669' : '#d97706'};">
                        ${p.estado}
                    </span>
                `;
                contenedor.appendChild(item);
            });
        }
    } catch (e) {
        console.warn('Error cargando pedidos:', e.message);
    }
}

// Renderizar el Stepper y el PIN en tiempo real según el estado
function renderizarVistaSeguimientoPedido(pedido) {
    pedidoSeguimientoActual = pedido;
    const panel = document.getElementById('panelSeguimientoPedido');
    panel.classList.remove('hidden');

    document.getElementById('trackCodPedido').textContent = `Pedido #${pedido.codigo_pedido.replace('KALO-2026-', '')}`;
    document.getElementById('trackNombrePlato').textContent = pedido.detalles?.[0]?.nombre_platillo || 'Bowl de salmón y quinoa';
    document.getElementById('trackTotalPagado').textContent = `$${pedido.total.toLocaleString('es-CL')}`;

    const stepNode1 = document.getElementById('stepNode1');
    const stepNode2 = document.getElementById('stepNode2');
    const stepNode3 = document.getElementById('stepNode3');
    const stepNode4 = document.getElementById('stepNode4');
    const stepLine1 = document.getElementById('stepLine1');
    const stepLine2 = document.getElementById('stepLine2');
    const stepLine3 = document.getElementById('stepLine3');

    const boxPrep = document.getElementById('boxPrepTiempo');
    const boxPin = document.getElementById('boxPinDestacado');
    const boxEntregado = document.getElementById('boxEntregaCompletada');

    boxPrep.classList.add('hidden');
    boxPin.classList.add('hidden');
    boxEntregado.classList.add('hidden');

    // Reset nodes
    [stepNode1, stepNode2, stepNode3, stepNode4].forEach(n => n.classList.remove('active'));
    [stepLine1, stepLine2, stepLine3].forEach(l => l.classList.remove('active'));

    stepNode1.classList.add('active');

    if (pedido.estado === 'Pagado') {
        document.getElementById('trackTituloEstado').textContent = 'Pagado';
        document.getElementById('trackSubtituloEstado').textContent = 'Estamos confirmando tu orden con la cocina.';
    } else if (pedido.estado === 'En Preparación') {
        stepNode2.classList.add('active');
        stepLine1.classList.add('active');
        document.getElementById('trackTituloEstado').textContent = 'En preparación';
        document.getElementById('trackSubtituloEstado').textContent = 'Verde Vivo está preparando tu comida.';
        boxPrep.classList.remove('hidden');
    } else if (pedido.estado === 'En Camino') {
        stepNode2.classList.add('active');
        stepNode3.classList.add('active');
        stepLine1.classList.add('active');
        stepLine2.classList.add('active');
        document.getElementById('trackTituloEstado').textContent = 'En camino';
        document.getElementById('trackSubtituloEstado').textContent = 'Tu comida ya salió de Verde Vivo.';
        
        // CAJA DESTACADA DEL PIN DE 4 DÍGITOS (MOCKUP 3.2)
        boxPin.classList.remove('hidden');
        document.getElementById('trackPinNumero').textContent = pedido.pin_seguridad || '0492';
    } else if (pedido.estado === 'Entregado') {
        [stepNode1, stepNode2, stepNode3, stepNode4].forEach(n => n.classList.add('active'));
        [stepLine1, stepLine2, stepLine3].forEach(l => l.classList.add('active'));
        document.getElementById('trackTituloEstado').textContent = 'Entregado ✓';
        document.getElementById('trackSubtituloEstado').textContent = `¡Buen provecho, ${usuarioActual.nombre}!`;
        
        boxEntregado.classList.remove('hidden');
    }
}

// ==========================================================================
// 4.4 EVALUACIÓN DE TRANSPARENCIA (MOCKUP 3.4 Y 3.5)
// ==========================================================================
let estrellasSeleccionadas = 5;
function abrirModalEvaluacion() {
    document.getElementById('formEvaluacionBody').classList.remove('hidden');
    document.getElementById('boxEvaluacionConfirmada').classList.add('hidden');
    document.getElementById('modalEvaluacionPedido').classList.remove('hidden');
}

function cerrarModalEvaluacion() {
    document.getElementById('modalEvaluacionPedido').classList.add('hidden');
}

function seleccionarEstrellas(tipo, count) {
    estrellasSeleccionadas = count;
    const stars = document.querySelectorAll('#starsCalificacionGeneral .star-btn');
    stars.forEach((s, idx) => {
        if (idx < count) s.classList.add('active');
        else s.classList.remove('active');
    });
}

async function enviarEvaluacionTransparencia() {
    if (!pedidoSeguimientoActual) return;
    const comentario = document.getElementById('evalComentario').value;

    try {
        const res = await fetch('/api/mongo/pedidos/evaluar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo_pedido: pedidoSeguimientoActual.codigo_pedido,
                similitud_foto: 5,
                gramaje_porcion: 4,
                velocidad_prep: 5,
                calificacion_general: estrellasSeleccionadas,
                comentario
            })
        });

        const data = await res.json();
        if (data.exito) {
            document.getElementById('formEvaluacionBody').classList.add('hidden');
            document.getElementById('boxEvaluacionConfirmada').classList.remove('hidden');
        }
    } catch (e) {
        document.getElementById('formEvaluacionBody').classList.add('hidden');
        document.getElementById('boxEvaluacionConfirmada').classList.remove('hidden');
    }
}

function cerrarModalEvaluacionYVolver() {
    cerrarModalEvaluacion();
    irATabCliente('pedidos');
}

// ==========================================================================
// 4.5 PERFIL & PLANES NUTRICIONALES (MOCKUP 4)
// ==========================================================================
function actualizarDatosPerfilVista() {
    if (!usuarioActual) return;
    document.getElementById('perfilNombre').textContent = usuarioActual.nombre;
    document.getElementById('perfilCorreo').textContent = usuarioActual.correo;
    
    const iniciales = usuarioActual.nombre.split(' ').map(n => n[0]).join('').substring(0, 2);
    document.getElementById('perfilAvatarIniciales').textContent = iniciales;

    const bio = usuarioActual.perfil_biometrico;
    if (bio) {
        document.getElementById('perfilImcValor').textContent = (bio.imc || 25.2).toString().replace('.', ',');
        document.getElementById('perfilMetaValor').textContent = `${(bio.meta_calorica_diaria || 1800).toLocaleString('es-CL')} kcal/día`;
        document.getElementById('editPeso').value = bio.peso_kg || 68.5;
        document.getElementById('editAltura').value = bio.altura_m || 1.65;
        document.getElementById('editEdad').value = bio.edad || 28;
        document.getElementById('editGenero').value = bio.genero || 'Femenino';
    }
}

async function guardarEdicionBiometrica() {
    const peso = parseFloat(document.getElementById('editPeso').value);
    const altura = parseFloat(document.getElementById('editAltura').value);
    const edad = parseInt(document.getElementById('editEdad').value);
    const genero = document.getElementById('editGenero').value;

    try {
        const res = await fetch('/api/mongo/usuarios/biometrico', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario_id: usuarioActual.id,
                peso, altura, edad, genero
            })
        });

        const data = await res.json();
        if (data.exito) {
            usuarioActual.perfil_biometrico = data.usuario.perfil_biometrico;
            actualizarDatosPerfilVista();
            actualizarBarraCaloriasGlobal();
            mostrarToast('Datos biométricos actualizados', 'success');
        }
    } catch (e) {
        mostrarToast('Datos guardados localmente', 'success');
    }
}

function abrirVistaPlanes() {
    document.getElementById('modalPlanesNutricionales').classList.remove('hidden');
}

function cerrarVistaPlanes() {
    document.getElementById('modalPlanesNutricionales').classList.add('hidden');
}

let planAContratar = null;
function abrirConfirmarContratarPlan(nombre, kcal, precio) {
    planAContratar = { nombre, kcal, precio };
    document.getElementById('confPlanNombre').textContent = nombre;
    document.getElementById('confPlanKcal').textContent = `${kcal} kcal/día`;
    document.getElementById('confPlanPrecio').textContent = `$${precio.toLocaleString('es-CL')} CLP / mes`;
    document.getElementById('modalConfirmarPlan').classList.remove('hidden');
}

function cerrarConfirmarPlan() {
    document.getElementById('modalConfirmarPlan').classList.add('hidden');
}

function ejecutarContratarPlan() {
    cerrarConfirmarPlan();
    cerrarVistaPlanes();
    mostrarToast(`🎉 ¡Plan "${planAContratar.nombre}" contratado con éxito!`, 'success');
}

function abrirModalEliminarDatos() {
    document.getElementById('modalEliminarDatos').classList.remove('hidden');
}

function cerrarModalEliminarDatos() {
    document.getElementById('modalEliminarDatos').classList.add('hidden');
}

async function confirmarEliminarDatos() {
    try {
        await fetch(`/api/mongo/usuarios/${usuarioActual.id}`, { method: 'DELETE' });
    } catch (e) {}
    cerrarModalEliminarDatos();
    cerrarSesion();
    mostrarToast('Tus datos han sido eliminados según Ley 21.713', 'info');
}

// ==========================================================================
// 5. RESTAURANTE: DASHBOARD ESCRITORIO & KANBAN (MOCKUP 5)
// ==========================================================================
function cambiarTabRestaurante(tabId) {
    document.querySelectorAll('.tab-desktop-view').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));

    if (tabId === 'pedidos') {
        document.getElementById('tabRestPedidos').classList.remove('hidden');
        document.getElementById('btnSidePedidos').classList.add('active');
        cargarTableroKanban();
    } else if (tabId === 'platillos') {
        document.getElementById('tabRestPlatillos').classList.remove('hidden');
        document.getElementById('btnSidePlatillos').classList.add('active');
        cargarTablaPlatillosRestaurante();
    } else if (tabId === 'crearPlatillo') {
        document.getElementById('tabRestCrearPlatillo').classList.remove('hidden');
        recalcularNutrientesPlatillo();
    } else if (tabId === 'local') {
        document.getElementById('tabRestLocal').classList.remove('hidden');
        document.getElementById('btnSideLocal').classList.add('active');
    } else if (tabId === 'evaluaciones') {
        document.getElementById('tabRestEvaluaciones').classList.remove('hidden');
        document.getElementById('btnSideEvaluaciones').classList.add('active');
        cargarEvaluacionesRestaurante();
    }
}

// Tablero Kanban de 4 columnas (Exclusivo por restaurante)
async function cargarTableroKanban() {
    try {
        const url = (usuarioActual && usuarioActual.rol === 'restaurante')
            ? `/api/mongo/pedidos?restaurante_id=${usuarioActual.id}`
            : '/api/mongo/pedidos';
        const res = await fetch(url);
        const data = await res.json();
        if (data.exito && data.datos) {
            pedidosGlobales = data.datos;
        }
    } catch (e) {}

    const colPagado = document.getElementById('kanbanColPagado');
    const colPrep = document.getElementById('kanbanColPrep');
    const colCamino = document.getElementById('kanbanColCamino');
    const colEntregado = document.getElementById('kanbanColEntregado');

    if (!colPagado || !colPrep || !colCamino || !colEntregado) return;

    colPagado.innerHTML = '';
    colPrep.innerHTML = '';
    colCamino.innerHTML = '';
    colEntregado.innerHTML = '';

    // Filtrar pedidos que pertenecen estrictamente a este restaurante
    const pedidosRestaurante = (usuarioActual && usuarioActual.rol === 'restaurante')
        ? pedidosGlobales.filter(p => {
            const rId = p.restaurante_id?._id || p.restaurante_id;
            return String(rId) === String(usuarioActual.id);
        })
        : pedidosGlobales;

    // Actualizar banner de nuevo pedido (solo si hay pedidos entrantes para este restaurante)
    const banner = document.getElementById('bannerAlertaPedido');
    if (banner) {
        const nuevoP = pedidosRestaurante.find(p => p.estado === 'Pagado' || p.estado === 'En Preparación');
        if (nuevoP) {
            banner.classList.remove('hidden');
            const codNum = nuevoP.codigo_pedido.replace('KALO-2026-', '');
            const bannerInfo = banner.querySelector('.banner-info-col');
            if (bannerInfo) {
                const nomPlato = nuevoP.detalles?.[0]?.nombre_platillo || 'Platillo Kalo';
                bannerInfo.innerHTML = `<strong>Nuevo pedido #${codNum}</strong><span>${nuevoP.cliente?.nombre || 'Cliente'} · $${nuevoP.total.toLocaleString('es-CL')} · ${nomPlato}</span>`;
            }
            const btnVer = banner.querySelector('button');
            if (btnVer) btnVer.onclick = () => enfocarPedidoKanban(codNum);
        } else {
            banner.classList.add('hidden');
        }
    }

    let c1 = 0, c2 = 0, c3 = 0, c4 = 0;

    pedidosRestaurante.forEach(p => {
        const card = document.createElement('div');
        card.className = 'kanban-item-card';

        const platoNom = p.detalles?.[0]?.nombre_platillo || 'Bowl nutritivo';
        const clienteNom = p.cliente?.nombre || 'Cliente Kalo';

        if (p.estado === 'Pagado') {
            c1++;
            card.innerHTML = `
                <strong>${p.codigo_pedido}</strong> - $${p.total.toLocaleString('es-CL')}<br>
                <small>${clienteNom} · ${platoNom}</small>
                <button class="btn btn-primary btn-block btn-sm mt-2" onclick="avanzarEstadoKanban('${p.codigo_pedido}', 'En Preparación')">
                    Preparar pedido
                </button>
            `;
            colPagado.appendChild(card);
        } else if (p.estado === 'En Preparación') {
            c2++;
            card.innerHTML = `
                <strong>${p.codigo_pedido}</strong> - $${p.total.toLocaleString('es-CL')}<br>
                <small>${clienteNom} · ${platoNom}</small>
                <button class="btn btn-secondary btn-block btn-sm mt-2" onclick="abrirModalSalidaPedido('${p.codigo_pedido}')">
                    Avanzar a En camino
                </button>
            `;
            colPrep.appendChild(card);
        } else if (p.estado === 'En Camino') {
            c3++;
            card.innerHTML = `
                <strong>${p.codigo_pedido}</strong> - $${p.total.toLocaleString('es-CL')}<br>
                <small>${clienteNom} · ${platoNom}</small>
                <span class="pin-status-tag">PIN generado · Esperando entrega</span>
            `;
            colCamino.appendChild(card);
        } else if (p.estado === 'Entregado') {
            c4++;
            card.innerHTML = `
                <strong>${p.codigo_pedido}</strong> - $${p.total.toLocaleString('es-CL')}<br>
                <small>${clienteNom} · ${platoNom}</small>
                <span class="badge-mini-green mt-1">✓ Entrega completada</span>
            `;
            colEntregado.appendChild(card);
        }
    });

    if (c1 === 0) colPagado.innerHTML = '<div class="text-subtle text-xs" style="text-align:center; padding:15px; color:#9ca3af;">Sin pedidos</div>';
    if (c2 === 0) colPrep.innerHTML = '<div class="text-subtle text-xs" style="text-align:center; padding:15px; color:#9ca3af;">Sin pedidos</div>';
    if (c3 === 0) colCamino.innerHTML = '<div class="text-subtle text-xs" style="text-align:center; padding:15px; color:#9ca3af;">Sin pedidos</div>';
    if (c4 === 0) colEntregado.innerHTML = '<div class="text-subtle text-xs" style="text-align:center; padding:15px; color:#9ca3af;">Sin pedidos</div>';

    document.getElementById('countColPagado').textContent = c1;
    document.getElementById('countColPrep').textContent = c2;
    document.getElementById('countColCamino').textContent = c3;
    document.getElementById('countColEntregado').textContent = c4;
}

// Avanzar estado de pedido en Atlas
async function avanzarEstadoKanban(codigo, nuevoEstado) {
    try {
        const res = await fetch('/api/mongo/pedidos/estado', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo_pedido: codigo, nuevo_estado: nuevoEstado })
        });
        const data = await res.json();
        if (data.exito) {
            mostrarToast(`Pedido ${codigo} actualizado a ${nuevoEstado}`, 'success');
            cargarTableroKanban();
        }
    } catch (e) {
        mostrarToast('Error al actualizar pedido', 'error');
    }
}

// Modal Confirmar salida con asignación de PIN (Mockup 5.1)
async function abrirModalSalidaPedido(codigo) {
    pedidoParaDespacharCodigo = codigo;
    document.getElementById('lblConfSalidaTitulo').textContent = `¿El pedido #${codigo.replace('KALO-2026-', '')} está listo para salir?`;
    await cargarRepartidoresEnSelect();
    document.getElementById('modalConfirmarSalidaPedido').classList.remove('hidden');
}

function cerrarModalSalidaPedido() {
    document.getElementById('modalConfirmarSalidaPedido').classList.add('hidden');
}

// Cargar lista dinámica de repartidores registrados en Atlas
async function cargarRepartidoresEnSelect() {
    const sel = document.getElementById('selectRepartidorSalida');
    if (!sel) return;
    try {
        const res = await fetch('/api/mongo/repartidores');
        const data = await res.json();
        if (data.exito && data.datos && data.datos.length > 0) {
            sel.innerHTML = '';
            data.datos.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r._id;
                opt.textContent = `${r.nombre} (${r.vehiculo || 'Repartidor'}) - Tel: ${r.telefono || 'Sin tel'}`;
                sel.appendChild(opt);
            });
        }
    } catch (e) {
        console.warn('Error al cargar repartidores:', e);
    }
}

async function confirmarDespachoPedido() {
    if (!pedidoParaDespacharCodigo) return;
    const repartidorId = document.getElementById('selectRepartidorSalida')?.value;
    cerrarModalSalidaPedido();

    try {
        const res = await fetch('/api/mongo/pedidos/estado', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                codigo_pedido: pedidoParaDespacharCodigo, 
                nuevo_estado: 'En Camino',
                repartidor_id: repartidorId || undefined
            })
        });
        const data = await res.json();
        if (data.exito) {
            mostrarToast('Pedido despachado con repartidor asignado. PIN disponible para el cliente.', 'success');
            cargarTableroKanban();
        } else {
            mostrarToast(data.mensaje || 'Error al despachar', 'error');
        }
    } catch (e) {
        mostrarToast('Error de conexión al despachar pedido', 'error');
    }
}

// Tabla de Platillos en Restaurante (Exclusivo por local)
function cargarTablaPlatillosRestaurante() {
    const tbody = document.getElementById('tbodyPlatillosRestaurante');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filtrar platillos que pertenecen a este restaurante
    const misPlatillos = (usuarioActual && usuarioActual.rol === 'restaurante')
        ? platillosGlobales.filter(plato => {
            const rId = plato.restaurante_id?._id || plato.restaurante_id;
            return String(rId) === String(usuarioActual.id);
        })
        : platillosGlobales;

    if (misPlatillos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:35px 20px; color:#6b7280;">
                    <div style="font-size:1.6rem; margin-bottom:8px;">🥗</div>
                    <strong>Aún no tienes platillos registrados en tu carta.</strong><br>
                    <small class="text-subtle">Crea tu primer platillo con ingredientes y método de cocción transparente.</small><br>
                    <button class="btn btn-primary btn-sm mt-3" onclick="cambiarTabRestaurante('crearPlatillo')">+ Crear mi primer platillo</button>
                </td>
            </tr>
        `;
        return;
    }

    misPlatillos.forEach(plato => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${plato.imagen_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80'}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">
                    <strong>${plato.nombre}</strong>
                </div>
            </td>
            <td>${plato.categoria || 'Almuerzo'}</td>
            <td><strong>${plato.calorias} kcal</strong></td>
            <td>$${plato.precio.toLocaleString('es-CL')}</td>
            <td>
                <span class="badge-mini-green">${plato.indice_transparencia || 85}%</span>
            </td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${plato.activo !== false ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="mostrarToast('Editor de platillo cargado', 'info')">✏️ Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Constructor Dinámico de Ingredientes (Mockup 5.2)
function agregarFilaIngrediente() {
    const tbody = document.querySelector('#tablaIngredientesDinamicos tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" placeholder="Ingrediente" class="ing-nombre" oninput="recalcularNutrientesPlatillo()"></td>
        <td><input type="number" placeholder="100" class="ing-cantidad" oninput="recalcularNutrientesPlatillo()"></td>
        <td>
            <select class="ing-coccion" onchange="recalcularNutrientesPlatillo()">
                <option value="A la plancha">A la plancha</option>
                <option value="Al vapor">Al vapor</option>
                <option value="Horneado">Horneado</option>
                <option value="Fresco">Fresco</option>
            </select>
        </td>
        <td><button type="button" class="btn-remove-row" onclick="eliminarFilaIngrediente(this)">×</button></td>
    `;
    tbody.appendChild(tr);
    recalcularNutrientesPlatillo();
}

function eliminarFilaIngrediente(btn) {
    btn.closest('tr').remove();
    recalcularNutrientesPlatillo();
}

// Cálculo Dinámico en Tiempo Real de Calorías y Transparencia
function recalcularNutrientesPlatillo() {
    const filas = document.querySelectorAll('#tablaIngredientesDinamicos tbody tr');
    let totalGramos = 0;
    filas.forEach(f => {
        const cant = parseFloat(f.querySelector('.ing-cantidad')?.value) || 0;
        totalGramos += cant;
    });

    // Estimación nutricional educativa
    const kcalEstimadas = Math.round(totalGramos * 1.5) || 520;
    const protEstimadas = Math.round(totalGramos * 0.15) || 38;
    const carbEstimados = Math.round(totalGramos * 0.18) || 45;
    const grasEstimadas = Math.round(totalGramos * 0.07) || 18;

    let transpScore = 60;
    if (filas.length >= 2) transpScore += 15;
    if (filas.length >= 4) transpScore += 10;
    transpScore = Math.min(transpScore, 100);

    document.getElementById('prevKcalTotal').textContent = kcalEstimadas;
    document.getElementById('prevProtTotal').textContent = `${protEstimadas}g`;
    document.getElementById('prevCarbTotal').textContent = `${carbEstimados}g`;
    document.getElementById('prevGrasaTotal').textContent = `${grasEstimadas}g`;
    document.getElementById('lblTranspCalculada').textContent = `${transpScore}/100`;
    document.getElementById('barTranspCalculada').style.width = `${transpScore}%`;
}

function actualizarPreviewPlatillo() {
    const nom = document.getElementById('newPlatoNombre').value;
    const precio = document.getElementById('newPlatoPrecio').value;
    const img = document.getElementById('newPlatoImg').value;

    if (nom) document.getElementById('prevNombrePlatillo').textContent = nom;
    if (precio) document.getElementById('prevPrecioPlatillo').textContent = `$${parseFloat(precio).toLocaleString('es-CL')}`;
    if (img) document.getElementById('prevImgPlatillo').src = img;
}

async function guardarNuevoPlatilloRestaurante(e) {
    e.preventDefault();
    const nombre = document.getElementById('newPlatoNombre').value;
    const categoria = document.getElementById('newPlatoCategoria').value;
    const precio = parseFloat(document.getElementById('newPlatoPrecio').value);
    const imagen_url = document.getElementById('newPlatoImg').value;
    const calorias = parseInt(document.getElementById('prevKcalTotal').textContent) || 520;

    // Recoger ingredientes
    const ingredientes = [];
    document.querySelectorAll('#tablaIngredientesDinamicos tbody tr').forEach(r => {
        const n = r.querySelector('.ing-nombre')?.value;
        const c = parseFloat(r.querySelector('.ing-cantidad')?.value) || 0;
        const m = r.querySelector('.ing-coccion')?.value;
        if (n) ingredientes.push({ nombre: n, cantidad_g: c, metodo_coccion: m });
    });

    try {
        const res = await fetch('/api/mongo/platillos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre, categoria, precio, calorias, imagen_url,
                proteinas: parseInt(document.getElementById('prevProtTotal').textContent),
                carbos: parseInt(document.getElementById('prevCarbTotal').textContent),
                grasas: parseInt(document.getElementById('prevGrasaTotal').textContent),
                ingredientes,
                restaurante_id: usuarioActual?.id
            })
        });

        const data = await res.json();
        if (data.exito) {
            mostrarToast(`✅ ${data.mensaje}`, 'success');
            cargarPlatillosDesdeServidor();
            cambiarTabRestaurante('platillos');
        }
    } catch (err) {
        mostrarToast('Error al guardar platillo', 'error');
    }
}

function simularSubidaFotoCocina() {
    mostrarToast('📷 Foto de cocina subida. Se actualizó la verificación de Dark Kitchens.', 'success');
}

function cargarEvaluacionesRestaurante() {
    const cont = document.getElementById('listaEvaluacionesRestaurante');
    if (!cont) return;
    cont.innerHTML = `
        <div class="card-inner-form mt-2">
            <div class="flex-between">
                <strong>Andrea Gómez · Pedido #1042</strong>
                <span class="text-xs text-subtle">Hace 2 horas</span>
            </div>
            <div class="mini-stars mt-1">⭐⭐⭐⭐⭐</div>
            <p class="text-xs mt-2">"Excelente porción, el salmón estaba en el punto exacto y los ingredientes coincidían perfecto con la foto."</p>
            <div class="alert-shield-transp mt-2">
                <small>Similitud con foto: 5/5 · Gramaje real: 5/5 · Rapidez: 5/5</small>
            </div>
        </div>
    `;
}

// ==========================================================================
// 6. REPARTIDOR MOBILE-FIRST (TECLADO PIN MOCKUP)
// ==========================================================================
let pedidosRepartidorList = [];
let pedidoRepartidorSeleccionado = null;

async function cargarPedidoRepartidor() {
    pinRepartidorActual = '';
    actualizarDisplayPinRepartidor();

    const select = document.getElementById('selectPedidoRepartidor');

    try {
        const res = await fetch('/api/mongo/pedidos');
        const data = await res.json();
        if (data.exito && data.datos && data.datos.length > 0) {
            // Filtrar pedidos activos (En Camino o En Preparación o Pagado)
            pedidosRepartidorList = data.datos.filter(p => p.estado !== 'Entregado' && p.estado !== 'Cancelado');
            if (pedidosRepartidorList.length === 0) {
                // Si todos fueron entregados, mostrar los últimos para que la UI no quede vacía
                pedidosRepartidorList = data.datos.slice(0, 3);
            }

            if (select) {
                select.innerHTML = '';
                pedidosRepartidorList.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.codigo_pedido;
                    const esMio = (usuarioActual && String(p.repartidor_id) === String(usuarioActual.id));
                    opt.textContent = `${p.codigo_pedido} [${p.estado}] - ${p.cliente?.nombre || 'Cliente'}${esMio ? ' (Asignado a ti)' : ''}`;
                    select.appendChild(opt);
                });
            }

            // Seleccionar primero uno asignado a este repartidor, o en camino, o en preparación
            const pedidoAsignado = (usuarioActual ? pedidosRepartidorList.find(p => String(p.repartidor_id) === String(usuarioActual.id) && p.estado === 'En Camino') : null)
                                || pedidosRepartidorList.find(p => p.estado === 'En Camino') 
                                || pedidosRepartidorList.find(p => p.estado === 'En Preparación') 
                                || pedidosRepartidorList[0];

            if (pedidoAsignado) {
                if (select) select.value = pedidoAsignado.codigo_pedido;
                mostrarDetallePedidoRepartidor(pedidoAsignado);
            }
        } else {
            if (select) select.innerHTML = '<option value="">No hay pedidos disponibles</option>';
        }
    } catch (e) {
        console.warn('Error al cargar pedidos para repartidor:', e);
    }
}

function seleccionarPedidoRepartidorDesdeSelect(codigo) {
    const pedido = pedidosRepartidorList.find(p => p.codigo_pedido === codigo);
    if (pedido) {
        mostrarDetallePedidoRepartidor(pedido);
    }
}

function mostrarDetallePedidoRepartidor(pedido) {
    pedidoRepartidorSeleccionado = pedido;
    document.getElementById('repCodigoPedido').textContent = pedido.codigo_pedido;
    document.getElementById('repClienteNombre').textContent = `Cliente: ${pedido.cliente?.nombre || 'Andrea Gómez'}`;
    const dir = pedido.cliente?.direccion || 'Av. Brasil 2950, Valparaíso';
    const repDir = document.getElementById('repDireccion');
    if (repDir) repDir.textContent = `📍 ${dir}`;
    document.getElementById('repTotal').textContent = `Total: $${pedido.total.toLocaleString('es-CL')}`;
    
    const badge = document.getElementById('repPedidoBadge');
    badge.textContent = pedido.estado;

    const btnAceptar = document.getElementById('btnRepAceptar');
    if (pedido.estado === 'En Preparación' || pedido.estado === 'Pagado') {
        btnAceptar.classList.remove('hidden');
        btnAceptar.textContent = '🛵 Aceptar y Llevar Pedido';
    } else {
        btnAceptar.classList.add('hidden');
    }
}

async function repartidorAceptarPedido() {
    const cod = document.getElementById('repCodigoPedido').textContent;
    try {
        const res = await fetch('/api/mongo/pedidos/aceptar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                codigo_pedido: cod,
                repartidor_id: usuarioActual ? usuarioActual.id : undefined
            })
        });
        const data = await res.json();
        if (data.exito) {
            mostrarToast(`¡Has aceptado el pedido ${cod}! En camino hacia el cliente.`, 'success');
            await cargarPedidoRepartidor();
        } else {
            await avanzarEstadoKanban(cod, 'En Camino');
            mostrarToast('Has aceptado el reparto. Ya estás en camino.', 'success');
            await cargarPedidoRepartidor();
        }
    } catch (e) {
        await avanzarEstadoKanban(cod, 'En Camino');
        cargarPedidoRepartidor();
    }
}

function teclearPinRepartidor(num) {
    if (pinRepartidorActual.length < 4) {
        pinRepartidorActual += num;
        actualizarDisplayPinRepartidor();
    }
}

function borrarPinRepartidor() {
    pinRepartidorActual = pinRepartidorActual.slice(0, -1);
    actualizarDisplayPinRepartidor();
}

function limpiarPinRepartidor() {
    pinRepartidorActual = '';
    actualizarDisplayPinRepartidor();
}

function actualizarDisplayPinRepartidor() {
    document.getElementById('repInputPin').value = pinRepartidorActual;
}

async function enviarValidacionPinRepartidor() {
    if (pinRepartidorActual.length !== 4) {
        mostrarToast('Debes ingresar los 4 dígitos del PIN', 'error');
        return;
    }

    const cod = document.getElementById('repCodigoPedido').textContent;

    try {
        const res = await fetch('/api/mongo/pedidos/validar-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                codigo_pedido: cod,
                pin_ingresado: pinRepartidorActual
            })
        });

        const data = await res.json();
        if (data.exito) {
            mostrarToast('🎉 ' + data.mensaje, 'success');
            limpiarPinRepartidor();
            cargarPedidoRepartidor();
            caloriasConsumidasHoy += 520; // Sumar calorías del pedido entregado
            actualizarBarraCaloriasGlobal();
        } else {
            mostrarToast('❌ ' + data.mensaje, 'error');
            limpiarPinRepartidor();
        }
    } catch (e) {
        mostrarToast('Error de conexión', 'error');
    }
}

// ==========================================================================
// 7. MODAL FILTROS AVANZADOS "A TU MEDIDA" (MOCKUP 2.3)
// ==========================================================================
function abrirModalFiltrosAvanzados() {
    document.getElementById('modalFiltrosAvanzados').classList.remove('hidden');
}

function cerrarModalFiltrosAvanzados() {
    document.getElementById('modalFiltrosAvanzados').classList.add('hidden');
}

function actualizarLabelKcal(val) {
    document.getElementById('lblValFiltroKcal').textContent = `${val} kcal`;
}

function actualizarLabelPrecio(val) {
    document.getElementById('lblValFiltroPrecio').textContent = `$${parseInt(val).toLocaleString('es-CL')}`;
}

function aplicarFiltrosAvanzados() {
    filtros.maxCalorias = parseInt(document.getElementById('rangeFiltroKcal').value);
    filtros.precioMax = parseInt(document.getElementById('rangeFiltroPrecio').value);
    filtros.altoProteina = document.getElementById('chkFiltroAltoProteina').checked;
    filtros.bajoCarbos = document.getElementById('chkFiltroBajoCarbos').checked;
    filtros.solo100Transp = document.getElementById('switchSolo100Transp').checked;

    cerrarModalFiltrosAvanzados();
    aplicarFiltrosYRenderizar();
    mostrarToast('Filtros aplicados', 'info');
}

// ==========================================================================
// 8. CONSOLA NoSQL (MQL) PARA EVALUACIÓN DOCENTE
// ==========================================================================
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
