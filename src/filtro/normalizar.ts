/**
 * Normaliza un texto para que los detectores vean lo que el usuario
 * quiso escribir, no cómo lo disfrazó.
 *
 * Ejemplos:
 *   "Once 5 cero dos"            -> "11 5 0 2"
 *   "juan arroba gmail punto com" -> "juan@gmail.com"
 *   "Instagrám"                  -> "instagram"
 */

const NUMEROS_EN_LETRAS: Record<string, string> = {
  cero: '0', uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4',
  cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9',
  diez: '10', once: '11', doce: '12', trece: '13', catorce: '14',
  quince: '15', dieciseis: '16', diecisiete: '17', dieciocho: '18',
  diecinueve: '19', veinte: '20',
};

export function quitarAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizar(texto: string): string {
  let t = quitarAcentos(texto.toLowerCase());

  // Números escritos en letras -> dígitos
  t = t.replace(/\b[a-z]+\b/g, (palabra) => NUMEROS_EN_LETRAS[palabra] ?? palabra);

  // "arroba", "(at)", "[at]" -> "@"
  t = t.replace(/\s*(?:\barroba\b|\(at\)|\[at\])\s*/g, '@');

  // "punto" / "(dot)" entre palabras -> "."  (ej: "gmail punto com")
  t = t.replace(/(\w)\s+(?:punto|\(dot\)|\[dot\]|dot)\s+(\w)/g, '$1.$2');

  // "juan @ gmail" -> "juan@gmail" (solo con espacios a ambos lados, para no
  // pegar un "@usuario" de red social a la palabra anterior)
  // y puntos sueltos dentro de dominios ("gmail . com")
  t = t.replace(/(\w)\s+@\s+(\w)/g, '$1@$2').replace(/(\w)\s*\.\s*(com|ar|net|org)\b/g, '$1.$2');

  // Colapsar espacios múltiples
  return t.replace(/\s+/g, ' ').trim();
}
