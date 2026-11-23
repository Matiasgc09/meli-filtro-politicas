import { describe, it, expect } from 'vitest';
import { revisarMensaje, normalizar } from '../src/filtro';

const tipos = (texto: string) => revisarMensaje(texto).infracciones.map((i) => i.tipo);

describe('normalizar', () => {
  it('convierte números escritos en letras', () => {
    expect(normalizar('Once cinco cero dos')).toBe('11 5 0 2');
  });
  it('reconstruye emails disfrazados', () => {
    expect(normalizar('juan arroba gmail punto com')).toBe('juan@gmail.com');
    expect(normalizar('juan (at) gmail . com')).toBe('juan@gmail.com');
  });
  it('quita acentos y mayúsculas', () => {
    expect(normalizar('InstaGRÁM')).toBe('instagram');
  });
});

describe('mensajes permitidos (no deben bloquearse)', () => {
  it.each([
    '¡Hola! Gracias por tu compra. El producto se despacha mañana.',
    'Para instalarlo, conectá primero el cable rojo y después encendé el equipo.',
    'Tu número de orden es 2000004567891234, cualquier duda escribinos por acá.',
    'El código de seguimiento es 36000123456 y lo podés ver en el detalle de la compra.',
    'El envío llega entre el 21/11/2026 y el 25-11-2026.',
    'El precio publicado es $ 1.250.000 con envío incluido.',
    'Te dejamos la publicación: https://articulo.mercadolibre.com.ar/MLA-123456789-producto',
    'Si tenés dudas, contactanos por este medio y te respondemos.',
    'En ese punto del proceso, tenés que reiniciar el equipo.',
  ])('%s', (texto) => {
    const r = revisarMensaje(texto);
    expect(r.infracciones).toEqual([]);
    expect(r.permitido).toBe(true);
  });
});

describe('teléfonos', () => {
  it.each([
    'Llamá al 11 5023 4455',
    'mi cel 11-5023-4455',
    '+54 9 11 5023-4455',
    'once cinco cero dos tres cuatro cuatro cinco cinco',
    '1 1 5 0 2 3 4 4 5 5',
  ])('bloquea: %s', (texto) => {
    expect(tipos(texto)).toContain('TELEFONO');
  });

  it('no confunde un teléfono con un nro de orden si no hay contexto de operación', () => {
    expect(tipos('te envio mi numero 1150234455')).toContain('TELEFONO');
  });
});

describe('emails', () => {
  it.each(['escribime a juan@gmail.com', 'juan arroba gmail punto com', 'ventas [at] tienda . com'])(
    'bloquea: %s',
    (texto) => {
      expect(tipos(texto)).toContain('EMAIL');
    },
  );
});

describe('links externos', () => {
  it.each(['mirá www.mitienda.com', 'https://bit.ly/abc123', 'entrá a mitienda.com.ar/ofertas', 'linktr.ee/mitienda'])(
    'bloquea: %s',
    (texto) => {
      expect(tipos(texto)).toContain('LINK_EXTERNO');
    },
  );

  it('permite links de Mercado Libre y sus subdominios', () => {
    expect(tipos('https://www.mercadolibre.com.ar/ayuda')).not.toContain('LINK_EXTERNO');
  });

  it('no confunde un dominio parecido con Mercado Libre', () => {
    expect(tipos('https://mercadolibre.com.ar.estafa.com/login')).toContain('LINK_EXTERNO');
  });
});

describe('redes sociales', () => {
  it.each(['buscanos en Instagram', 'mandame un wsp', 'seguinos @mitienda.oficial', 'tenemos WhatsApp'])(
    'bloquea: %s',
    (texto) => {
      expect(tipos(texto)).toContain('RED_SOCIAL');
    },
  );
});

describe('datos bancarios', () => {
  it('bloquea un CBU de 22 dígitos', () => {
    expect(tipos('0110599520000001234567')).toContain('DATOS_BANCARIOS');
  });
  it.each(['te paso el alias', 'mandame el CBU', 'transferime y listo', 'depositá en mi caja de ahorro'])(
    'bloquea: %s',
    (texto) => {
      expect(tipos(texto)).toContain('DATOS_BANCARIOS');
    },
  );
});

describe('invitaciones a operar fuera de la plataforma', () => {
  it.each([
    'si querés lo hacemos por fuera',
    'te hago descuento si pagás en efectivo',
    'compralo directo y te sale más barato',
    'pasame tu número y te explico',
    'escribime y lo coordinamos',
    'lo vemos fuera de Mercado Libre',
    'está más barato en nuestra página',
  ])('bloquea: %s', (texto) => {
    expect(tipos(texto)).toContain('FUERA_DE_PLATAFORMA');
  });
});

describe('longitud', () => {
  it('bloquea mensajes que superan el límite configurado', () => {
    const r = revisarMensaje('a'.repeat(20), { maxCaracteres: 10 });
    expect(r.permitido).toBe(false);
    expect(r.infracciones[0].tipo).toBe('LONGITUD');
  });
});

describe('resultado', () => {
  it('reporta varias infracciones en un mismo mensaje', () => {
    const r = revisarMensaje('escribime al 11 5023 4455 o a juan@gmail.com');
    expect(r.permitido).toBe(false);
    expect(new Set(r.infracciones.map((i) => i.tipo))).toEqual(
      new Set(['TELEFONO', 'EMAIL', 'FUERA_DE_PLATAFORMA']),
    );
  });
});
