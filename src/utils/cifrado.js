/**
 * Cifrado de los datos de salud en la base de datos (RNF-02, Ley 21.719).
 * AES-256-GCM: cada valor se guarda como "enc:v1:<iv>:<tag>:<datos>" (base64).
 * La clave sale de DATOS_SALUD_CLAVE en el archivo .env (nunca se sube a GitHub).
 * Si alguien copia la base, ve textos cifrados en vez de peso, altura o IMC.
 */
const crypto = require('crypto');

const PREFIJO = 'enc:v1:';

if (!process.env.DATOS_SALUD_CLAVE) {
    console.warn('⚠️  Falta DATOS_SALUD_CLAVE en el archivo .env. Se deriva una clave de JWT_SECRET (solo para desarrollo).');
}
// La clave siempre mide 32 bytes: se deriva con SHA-256 del texto configurado
const CLAVE = crypto.createHash('sha256')
    .update(process.env.DATOS_SALUD_CLAVE || process.env.JWT_SECRET || 'kalo-desarrollo-solo-local')
    .digest();

function cifrar(valor) {
    if (valor === null || valor === undefined || valor === '') return valor;
    const texto = String(valor);
    if (texto.startsWith(PREFIJO)) return texto; // ya está cifrado
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', CLAVE, iv);
    const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
    return PREFIJO + [iv, c.getAuthTag(), datos].map(b => b.toString('base64')).join(':');
}

function descifrar(valor) {
    if (valor === null || valor === undefined) return valor;
    const texto = String(valor);
    if (!texto.startsWith(PREFIJO)) return texto; // dato antiguo sin cifrar
    try {
        const [iv, tag, datos] = texto.slice(PREFIJO.length).split(':').map(s => Buffer.from(s, 'base64'));
        const d = crypto.createDecipheriv('aes-256-gcm', CLAVE, iv);
        d.setAuthTag(tag);
        return Buffer.concat([d.update(datos), d.final()]).toString('utf8');
    } catch (e) {
        console.error('No se pudo descifrar un dato de salud (¿cambió DATOS_SALUD_CLAVE?)');
        return null;
    }
}

// Para usar en esquemas de Mongoose: el campo se guarda cifrado y se lee como número
const numeroCifrado = {
    set: (v) => cifrar(v),
    get: (v) => { const t = descifrar(v); return t === null || t === undefined || t === '' ? t : Number(t); }
};
const textoCifrado = { set: (v) => cifrar(v), get: (v) => descifrar(v) };

const estaCifrado = (v) => typeof v === 'string' && v.startsWith(PREFIJO);

module.exports = { cifrar, descifrar, numeroCifrado, textoCifrado, estaCifrado };
