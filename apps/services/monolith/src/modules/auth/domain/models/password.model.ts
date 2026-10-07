import { DataValidationException } from '../../../../common/exceptions/data-validation.exception';

/**
 * Mínimo de **caracteres** en el alta.
 *
 * 12, no 8. Es lo que recomienda la guía del paquete que verifica las
 * contraseñas, y es un mínimo razonable para una cuenta con correo como
 * recuperador: con 8, `Password1` pasa.
 */
const MIN_LENGTH = 12;

/**
 * Máximo de **bytes**, y esto no es un detalle de estilo.
 *
 * scrypt lee la contraseña hasta un tope y **no avisa** de lo que se pasa: a
 * partir de aquí dos contraseñas distintas dan el mismo hash. Así que un máximo
 * de 72 caracteres que no sea de bytes dejaría pasar
 * `aaaa…(71)á` y `aaaa…(72)á` como si fueran la misma.
 *
 * Además hay un límite duro en el propio paquete: rechaza con `RangeError` lo que
 * pase de 4 KiB. Si dejamos que llegue hasta ahí, el error sale del hasher y no
 * del dominio, que es donde debería salir.
 */
const MAX_BYTES = 72;

/** El campo del formulario al que pertenece el error, para pintarlo debajo del input. */
const FIELD = 'password';

/**
 * Una contraseña validada, que es lo único que puede salir de aquí.
 *
 * El constructor es privado a propósito: la única forma de tener un `Password` es
 * `Password.create()`, que valida. Un `new Password('a')` no compila desde fuera,
 * y con él desaparece toda una familia de errores: un hash de una contraseña sin
 * validar, o un `undefined` que llega al hasher.
 *
 * ## Lo que este value object NO hace
 *
 * No dice si una contraseña es buena. Eso no se puede medir dentro del sistema:
 * lo que se puede medir es que cumple un mínimo y que no excede lo que el
 * algoritmo puede distinguir. La calidad la pone quien la elige, y la mide un
 * checker externo contra la lista de contraseñas filtradas.
 *
 * ## Por qué vive en `domain` y no en el DTO
 *
 * Porque las reglas las tiene que cumplir **quien llama**, no quien recibe. Si
 * el mínimo viviera en el `RegisterDto`, un caso de uso que se llame desde otro
 * sitio —un import de datos, un script— no lo cumpliría, y el hash se haría
 * igual. El DTO repite estas reglas para dar el error en el borde, pero no es el
 * sitio donde se garantizan.
 */
export class Password {
  private constructor(private readonly plain: string) {}

  /**
   * Valida y devuelve la contraseña.
   *
   * `string` a propósito, no `unknown`: el paquete normaliza a NFKC y rechaza
   * con `RangeError` lo que no sea texto, pero si eso llega a un `try/catch`
   * genérico se pierde el mensaje de por qué. Aquí el error es un
   * `DataValidationException` con el campo, que el cliente sabe pintar.
   */
  static create(plain: string): Password {
    if (typeof plain !== 'string' || plain.length < MIN_LENGTH) {
      Password.fail(`Password must be at least ${MIN_LENGTH} characters long`);
    }

    // En bytes y no en `length`: 'ñ' son 2 bytes en UTF-8, así que 60
    // caracteres con tildes pueden pesar más de 72 y colgarse del `length`.
    const bytes = Buffer.byteLength(plain, 'utf8');
    if (bytes > MAX_BYTES) {
      Password.fail(
        `Password cannot be longer than ${MAX_BYTES} bytes (it is ${bytes})`,
      );
    }

    return new Password(plain);
  }

  /**
   * El mensaje va dos veces: suelto en `message`, y dentro de `errors[]` con su
   * campo para quien reparte los errores por input. Sin lo segundo, el cliente
   * solo puede pintarlo en un banner, que es justo donde no se agradece en un
   * formulario de contraseña.
   */
  private static fail(message: string): never {
    throw new DataValidationException(message, [{ field: FIELD, message }]);
  }

  /**
   * El texto plano, para pasarlo al hasher.
   *
   * Es el único accessor y es público a propósito: sin él, el `Password` no
   * serviría para nada. Lo que no existe es el camino inverso, y por eso el tipo
   * no es `string`: al loguear un `Password` sale `[Password]`, no la contraseña.
   */
  get value(): string {
    return this.plain;
  }

  /** Para que un log no imprima la contraseña. */
  toString(): string {
    return '[Password]';
  }
}

/** Los límites, para que los tests y el DTO no los repitan como números mágicos. */
export const PASSWORD_LIMITS = {
  minLength: MIN_LENGTH,
  maxBytes: MAX_BYTES,
  field: FIELD,
} as const;
