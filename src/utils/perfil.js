/**
 * Perfil biométrico: validación, cálculo de IMC y meta (RF-01 a RF-03) y salida pública
 * (los campos vienen descifrados por los getters de Mongoose).
 */
const { calcularImc, estadoImc, calcularMetaCalorica, ACTIVIDAD, OBJETIVOS } = require('./nutricion');

const GENEROS = ['Masculino', 'Femenino', 'Otro'];

// Recibe los datos del formulario (pueden venir como texto) y devuelve { perfil } o { error }
function armarPerfil(entrada, anterior = {}) {
    const num = (v, previo) => (v === undefined || v === '' || v === null ? previo : parseFloat(String(v).replace(',', '.')));
    const peso_kg = num(entrada.peso, anterior.peso_kg);
    const altura_m = num(entrada.altura, anterior.altura_m);
    const edad = entrada.edad === undefined || entrada.edad === '' ? anterior.edad : parseInt(entrada.edad, 10);
    if (!(peso_kg >= 20 && peso_kg <= 350) || !(altura_m >= 1 && altura_m <= 2.5) || !(edad >= 12 && edad <= 110)) {
        return { error: 'Revisa tus datos: peso entre 20 y 350 kg, altura entre 1,00 y 2,50 m y edad entre 12 y 110 años.' };
    }
    const genero = GENEROS.includes(entrada.genero) ? entrada.genero : (anterior.genero || 'Otro');
    const nivel_actividad = ACTIVIDAD[entrada.nivel_actividad] ? entrada.nivel_actividad : (anterior.nivel_actividad || 'ligero');
    const objetivo = OBJETIVOS[entrada.objetivo] ? entrada.objetivo : (OBJETIVOS[anterior.objetivo] ? anterior.objetivo : 'mantener');
    const meta = calcularMetaCalorica({ peso_kg, altura_m, edad, genero, nivel_actividad, objetivo });
    return {
        perfil: {
            peso_kg, altura_m, edad, genero, nivel_actividad, objetivo,
            imc: calcularImc(peso_kg, altura_m),
            meta_calorica_diaria: meta,
            objetivo_salud: OBJETIVOS[objetivo].texto
        },
        metaRecomendada: meta
    };
}

// Datos del perfil para el frontend (números descifrados + estado del IMC)
function perfilPublico(usuario) {
    const pb = usuario.perfil_biometrico || {};
    const datos = {
        peso_kg: pb.peso_kg, altura_m: pb.altura_m, edad: pb.edad, genero: pb.genero,
        nivel_actividad: pb.nivel_actividad || 'ligero', objetivo: pb.objetivo || 'mantener',
        imc: pb.imc, estado_imc: estadoImc(pb.imc),
        meta_calorica_diaria: pb.meta_calorica_diaria, objetivo_salud: pb.objetivo_salud
    };
    // Meta recomendada por la fórmula, aunque el cliente tenga un plan con otra meta
    if (pb.peso_kg && pb.altura_m && pb.edad) {
        datos.meta_recomendada = calcularMetaCalorica({ ...datos });
    }
    return datos;
}

module.exports = { armarPerfil, perfilPublico };
