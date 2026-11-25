// Compresión de fotos en el navegador antes de subirlas (RNF-05): la imagen se reduce a `lado`
// píxeles como máximo y se convierte a JPEG. Una foto de celular de 4 MB queda en ~150 KB.
export const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_ARCHIVO = 10 * 1024 * 1024; // 10 MB antes de comprimir

export function comprimirFoto(archivo, lado = 800, calidad = 0.8) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      const ctx = lienzo.getContext('2d');
      ctx.fillStyle = '#fff'; // fondo blanco para PNG con transparencia
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      resolver(lienzo.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

// Revisa el archivo y lo comprime hasta que pese menos de ~480 KB
export async function prepararFoto(archivo, lado = 1000) {
  if (!TIPOS_FOTO.includes(archivo.type)) throw new Error('La foto debe ser JPG, PNG o WebP.');
  if (archivo.size > MAX_ARCHIVO) throw new Error('La foto pesa más de 10 MB. Elige una más liviana.');
  let datos = await comprimirFoto(archivo, lado);
  if (datos.length > 650000) datos = await comprimirFoto(archivo, Math.round(lado * 0.75), 0.7);
  return datos;
}
