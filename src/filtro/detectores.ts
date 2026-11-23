import { Infraccion } from './tipos';

/** Un detector recibe el texto normalizado y devuelve las infracciones encontradas. */
export type Detector = (texto: string, ctx: ContextoDeteccion) => Infraccion[];

export interface ContextoDeteccion {
  dominiosPermitidos: string[];
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/g;

const TLDS = 'com|net|org|ar|io|me|co|ly|ee|gl|to|info|app|site|store|shop|link|bio|xyz|online|tk';
const URL_CON_PROTOCOLO = /\b(?:https?:\/\/|www\.)[^\s]+/g;
const DOMINIO_SUELTO = new RegExp(
  `\\b[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:${TLDS})(?:\\.[a-z]{2})?\\b(?:\\/[^\\s]*)?`,
  'g',
);

/** Corridas de 8+ dígitos con separadores típicos de teléfono (espacios, puntos, guiones, paréntesis). */
const CORRIDA_DIGITOS = /\+?\d(?:[\s.\-()]*\d){7,}/g;
const FECHA = /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g;

/**
 * Palabras que, si aparecen justo antes de un número largo, indican que es un
 * dato de la operación (orden, seguimiento, factura) y no un teléfono.
 * Ojo: "envio" queda afuera a propósito ("te envio mi numero ...").
 */
const CONTEXTO_OPERACION =
  /\b(orden|pedido|venta|compra|seguimiento|tracking|factura|publicacion|articulo|mla)\b[^\d]{0,25}$/;

const REDES = new RegExp(
  '\\b(instagram|insta|ig|facebook|fb|whatsapp|whats app|wsp|wpp|wapp|telegram|tiktok|twitter|youtube|linkedin|signal)\\b',
  'g',
);
const HANDLE = /(?:^|\s)(@[a-z0-9_.]{3,})/g;

const BANCARIO =
  /\b(cbu|cvu|alias|cuenta bancaria|(?:nro|numero) de cuenta|caja de ahorro|cuenta corriente|transferencia bancaria|transferi(?:me|nos)?|deposit(?:a|ame|anos|o))\b/g;

const MEDIO_PERMITIDO = '(?!\\s+(?:por|a traves de|desde)\\s+(?:aca|aqui|este medio|este chat|la mensajeria|mercado libre|ml))';

const FUERA_PLATAFORMA: Array<[RegExp, string]> = [
  [/\b(?:por )?fuera de (?:mercado ?libre|ml|meli|la plataforma)\b/g, 'Propone operar fuera de Mercado Libre'],
  [/\bpor fuera\b/g, 'Propone operar por fuera'],
  [/\bsin (?:pasar por )?(?:mercado ?libre|ml|meli)\b/g, 'Propone operar sin Mercado Libre'],
  [
    new RegExp(`\\b(?:escribime|escribinos|llamame|llamanos|contactame|contactanos|hablame|hablanos|agregame|agreganos)\\b${MEDIO_PERMITIDO}`, 'g'),
    'Invita a contactar por otro medio',
  ],
  [/\b(?:pasame|pasanos|dame|danos|mandame|mandanos) (?:tu|el|un) (?:numero|telefono|tel|cel|celular|mail|correo|email)\b/g, 'Pide datos de contacto'],
  [/\b(?:mi|nuestro) (?:numero|telefono|tel|cel|celular|mail|correo|email)\b/g, 'Ofrece datos de contacto'],
  [/\bdescuento si (?:pagas|abonas|compras|transferis)\b/g, 'Ofrece descuento por pagar fuera de la plataforma'],
  [/\b(?:pago|pagar|pagas|pagalo|abonar|abonas) en efectivo\b/g, 'Propone pago en efectivo'],
  [/\b(?:compra(?:lo|r)?|vend(?:o|emos|erte)) directo\b/g, 'Propone compra directa'],
  [/\bnuestr[oa] (?:pagina|sitio|web|tienda online)\b/g, 'Deriva a un sitio propio'],
];

function sinRepetidos(infracciones: Infraccion[]): Infraccion[] {
  const vistos = new Set<string>();
  return infracciones.filter((i) => {
    const clave = `${i.tipo}|${i.fragmento}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

export const detectarEmails: Detector = (texto) =>
  [...texto.matchAll(EMAIL)].map((m) => ({
    tipo: 'EMAIL',
    fragmento: m[0],
    motivo: 'Dirección de correo electrónico',
  }));

function hostDe(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0];
}

export function esDominioPermitido(host: string, permitidos: string[]): boolean {
  return permitidos.some((d) => host === d || host.endsWith(`.${d}`));
}

export const detectarLinks: Detector = (texto, ctx) => {
  const sinEmails = texto.replace(EMAIL, ' ');
  const candidatos = [
    ...[...sinEmails.matchAll(URL_CON_PROTOCOLO)].map((m) => m[0]),
    ...[...sinEmails.replace(URL_CON_PROTOCOLO, ' ').matchAll(DOMINIO_SUELTO)].map((m) => m[0]),
  ];
  return candidatos
    .filter((url) => !esDominioPermitido(hostDe(url.replace(/[.,;:!?)]+$/, '')), ctx.dominiosPermitidos))
    .map((url) => ({ tipo: 'LINK_EXTERNO', fragmento: url, motivo: 'Link a un sitio externo a Mercado Libre' }));
};

export const detectarNumerosLargos: Detector = (texto) => {
  const sinFechas = texto.replace(FECHA, (f) => ' '.repeat(f.length));
  const infracciones: Infraccion[] = [];

  for (const m of sinFechas.matchAll(CORRIDA_DIGITOS)) {
    const digitos = m[0].replace(/\D/g, '');
    const previo = sinFechas.slice(Math.max(0, (m.index ?? 0) - 40), m.index);

    if (digitos.length === 22) {
      infracciones.push({ tipo: 'DATOS_BANCARIOS', fragmento: m[0].trim(), motivo: 'Número con formato de CBU/CVU' });
      continue;
    }
    if (CONTEXTO_OPERACION.test(previo)) continue; // nro. de orden, seguimiento, etc.
    if (digitos.length >= 8 && digitos.length <= 13) {
      infracciones.push({ tipo: 'TELEFONO', fragmento: m[0].trim(), motivo: 'Número con formato de teléfono' });
    }
  }
  return infracciones;
};

export const detectarRedes: Detector = (texto) => {
  const sinEmails = texto.replace(EMAIL, ' ');
  return [
    ...[...sinEmails.matchAll(REDES)].map((m) => ({
      tipo: 'RED_SOCIAL' as const,
      fragmento: m[0],
      motivo: 'Mención de red social o app de mensajería',
    })),
    ...[...sinEmails.matchAll(HANDLE)].map((m) => ({
      tipo: 'RED_SOCIAL' as const,
      fragmento: m[1],
      motivo: 'Usuario de red social (@usuario)',
    })),
  ];
};

export const detectarDatosBancarios: Detector = (texto) =>
  [...texto.matchAll(BANCARIO)].map((m) => ({
    tipo: 'DATOS_BANCARIOS',
    fragmento: m[0],
    motivo: 'Referencia a datos bancarios o pagos por fuera',
  }));

export const detectarFueraDePlataforma: Detector = (texto) =>
  FUERA_PLATAFORMA.flatMap(([regex, motivo]) =>
    [...texto.matchAll(regex)].map((m) => ({ tipo: 'FUERA_DE_PLATAFORMA' as const, fragmento: m[0], motivo })),
  );

export const DETECTORES: Detector[] = [
  detectarEmails,
  detectarLinks,
  detectarNumerosLargos,
  detectarRedes,
  detectarDatosBancarios,
  detectarFueraDePlataforma,
];

export function ejecutarDetectores(texto: string, ctx: ContextoDeteccion): Infraccion[] {
  return sinRepetidos(DETECTORES.flatMap((d) => d(texto, ctx)));
}
