async function ejecutar(url, metodo, cuerpo = null) {
    const sqlViewer = document.getElementById('sqlViewer');
    const outputJSON = document.getElementById('outputJSON');
    
    sqlViewer.innerText = 'Ejecutando petición...';
    outputJSON.innerText = 'Cargando...';

    try {
        const opciones = {
            method: metodo,
            headers: { 'Content-Type': 'application/json' }
        };
        if (cuerpo) {
            opciones.body = JSON.stringify(cuerpo);
        }

        const res = await fetch(url, opciones);
        const data = await res.json();
        
        if (data.sql) {
            sqlViewer.innerHTML = `<strong>Tipo:</strong> ${data.tipo || 'SQL'} | <strong>Descripción:</strong> ${data.descripcion || ''}<br><br><code>${data.sql}</code>`;
        } else {
            sqlViewer.innerHTML = `<strong>Operación completada con éxito</strong>`;
        }
        outputJSON.innerText = JSON.stringify(data, null, 2);
    } catch (error) {
        sqlViewer.innerText = 'Error al ejecutar la consulta';
        outputJSON.innerText = error.message;
    }
}

// 4. INSERT Nuevo Cliente desde formulario
document.getElementById('formNuevoCliente').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cliente = {
        nombre: document.getElementById('cliNombre').value,
        correo: document.getElementById('cliCorreo').value,
        password: document.getElementById('cliPassword').value,
        peso: parseFloat(document.getElementById('cliPeso').value),
        altura: parseFloat(document.getElementById('cliAltura').value),
        edad: parseInt(document.getElementById('cliEdad').value),
        genero: document.getElementById('cliGenero').value
    };
    await ejecutar('/api/consultas/clientes', 'POST', cliente);
    document.getElementById('formNuevoCliente').reset();
});

// 6. UPDATE Datos físicos desde formulario
document.getElementById('formUpdateCliente').addEventListener('submit', async function(e) {
    e.preventDefault();
    const datos = {
        idCliente: parseInt(document.getElementById('updId').value),
        nuevoPeso: parseFloat(document.getElementById('updPeso').value),
        nuevaAltura: parseFloat(document.getElementById('updAltura').value)
    };
    await ejecutar('/api/consultas/clientes', 'PUT', datos);
});

// Login Original
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const correo = document.getElementById('correo').value;
    const password = document.getElementById('password').value;

    try {
        const respuesta = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password })
        });
        const datos = await respuesta.json();
        const elem = document.getElementById('mensajeLogin');
        elem.innerText = datos.mensaje;
        elem.style.color = respuesta.ok ? '#27ae60' : '#e74c3c';
    } catch (error) {
        const elem = document.getElementById('mensajeLogin');
        elem.innerText = "Error al conectar con el servidor.";
        elem.style.color = '#e74c3c';
    }
});

// Cargar estado inicial
ejecutar('/api/consultas/estado', 'GET');

