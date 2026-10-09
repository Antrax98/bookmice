import { Password, PASSWORD_LIMITS } from './password.model';
import { DataValidationException } from '../../../../common/exceptions/data-validation.exception';

/**
 * Tests de `Password`.
 *
 * El caso que más importa es el de los **bytes**, no el de los caracteres: son
 * la misma regla contada de dos formas, y la que falla en silencio es la de
 * bytes.
 */

const valida = 'contrasena-larga-1';

describe('Password.create', () => {
  it('acepta una contraseña que cumple el mínimo', () => {
    const password = Password.create(valida);

    expect(password.value).toBe(valida);
  });

  it('acepta exactamente el mínimo', () => {
    const exacta = 'a'.repeat(PASSWORD_LIMITS.minLength);

    expect(Password.create(exacta).value).toHaveLength(
      PASSWORD_LIMITS.minLength,
    );
  });

  it('rechaza una por debajo del mínimo', () => {
    expect(() => Password.create('a'.repeat(11))).toThrow(
      DataValidationException,
    );
  });

  it('rechaza una vacía', () => {
    expect(() => Password.create('')).toThrow(DataValidationException);
  });

  /**
   * El que no hay que quedarse sin él.
   *
   * 40 `ñ` son 40 caracteres pero **80 bytes**. Con un límite contado en
   * caracteres pasaría el filtro del DTO y llegaría al hasher, que corta a los 72
   * bytes. Y a partir de ahí dos contraseñas distintas dan el mismo hash, así que
   * el usuario podría entrar con una contraseña que nunca escribió.
   */
  it('rechaza una que cabe en caracteres pero no en bytes', () => {
    const deManyasTildes = 'ñ'.repeat(40);

    expect(deManyasTildes).toHaveLength(40); // 40 caracteres
    expect(Buffer.byteLength(deManyasTildes, 'utf8')).toBe(80); // 80 bytes

    expect(() => Password.create(deManyasTildes)).toThrow(
      DataValidationException,
    );
  });

  it('acepta exactamente el máximo de bytes', () => {
    // 36 caracteres ASCII = 36 bytes, bien por debajo del límite: el caso
    // interesante es el de los bytes, que ya cubre el test de las tildes.
    const justa = 'a'.repeat(PASSWORD_LIMITS.maxBytes);

    expect(Password.create(justa).value).toHaveLength(PASSWORD_LIMITS.maxBytes);
  });

  it('rechaza una por encima del máximo de bytes', () => {
    expect(() =>
      Password.create('a'.repeat(PASSWORD_LIMITS.maxBytes + 1)),
    ).toThrow(DataValidationException);
  });

  /**
   * El mensaje dice cuántos bytes son, y no solo el límite. Un usuario con
   * muchos acentos no entiende por qué su contraseña de 40 caracteres es
   * demasiado larga, y el número concreto se lo explica.
   */
  it('el error dice cuántos bytes tiene, no solo el límite', () => {
    try {
      Password.create('ñ'.repeat(40));
      fail('deberia haber lanzado');
    } catch (error) {
      expect((error as DataValidationException).message).toContain('80');
    }
  });

  it('el error lleva el campo, para que el cliente lo pinte bajo su input', () => {
    try {
      Password.create('corta');
      fail('deberia haber lanzado');
    } catch (error) {
      expect((error as DataValidationException).errors).toEqual([
        expect.objectContaining({ field: 'password' }),
      ]);
    }
  });
});

describe('Password.toString', () => {
  /**
   * Un `console.log` de algo que lleve la credencial no puede imprimirla.
   *
   * Sin esto, `String(password)` sale con el texto plano dentro, y un log de
   * error en cualquier sitio lo suelta.
   */
  it('no imprime la contraseña', () => {
    const password = Password.create(valida);

    // `String(...)` y no `${password}` a propósito: el template llama a
    // `toString()` igual, pero el lint marca interpolar un `Password` como
    // inválido, porque **parece** que se está convirtiendo a texto para usarlo.
    // Aquí es justo lo que se quiere comprobar.
    const comoTexto = String(password);

    expect(comoTexto).not.toContain(valida);
    expect(comoTexto).toContain('Password');
  });
});
