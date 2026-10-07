import { Injectable } from '@nestjs/common';
import { PasswordHasher as NestPasswordHasher } from '@nestjs/authentication';
import { PasswordHasherPort } from '../../application/ports/password-hasher.port';

/**
 * Adapter de `PasswordHasherPort` sobre el `PasswordHasher` del paquete.
 *
 * ## Por qué un puerto para esto, si el hasher ya es un provider inyectable
 *
 * Porque `application` no puede depender de `infrastructure`, y el puerto es lo
 * que deja que `RegisterUseCase` y `LoginUseCase` hashten sin conocer de dónde
 * sale el hasher.
 *
 * ## Por qué no es solo un `export { PasswordHasher }` con otro nombre
 *
 * Por los tests. scrypt con `logN: 17` son **128 MiB y casi un segundo por
 * hash**, en un threadpool de cuatro hilos. Los tests de los casos de uso
 * necesitarían hashear, y con el hasher real cada test tardaría un segundo, el
 * proceso se comería cientos de MiB y dos tests en paralelo bloquearían a los
 * demás.
 *
 * Con este puerto, los tests meten un doble que devuelve `hash:plain`. El
 * hasher real se ejercita en la prueba de integración contra Postgres, que es
 * donde tiene sentido.
 *
 * ## Lo que NO se reimplementa aquí
 *
 * Ni scrypt, ni los parámetros, ni la normalización NFKC. Todo eso lo hace el
 * paquete, con los parámetros que le pasamos en `authentication-options.ts`.
 *
 * En concreto, esto **no** reimplementa:
 * - la comparación en tiempo constante,
 * - el hash señuelo para las cuentas inexistentes, que es lo que evita que el
 *   login revele qué correos están dados de alta,
 * - la normalización NFKC, por la que la misma contraseña escrita en dos
 *   teclados verifica igual.
 *
 * Todo eso llega aquí dentro. Un adapter que reimplementara estas cosas las
 * haría peor.
 */
@Injectable()
export class PasswordHasherAdapter implements PasswordHasherPort {
  constructor(private readonly hasher: NestPasswordHasher) {}

  async hash(password: string): Promise<string> {
    return this.hasher.hash(password);
  }

  /**
   * Delega tal cual, y el `undefined` se pasa sin tocar.
   *
   * Es el detalle que no hay que "simplificar": si el usuario no existe, hay que
   * verificar **contra un hash inexistente**, para que el hasher haga su trabajo
   * y el tiempo de respuesta no revele si la cuenta existe. Devolver `false` al
   * instante aquí sería una fuga de información.
   *
   * Ver la nota sobre enumeración en `PasswordHasherPort.verify`.
   */
  async verify(
    password: string,
    encoded: string | null | undefined,
  ): Promise<boolean> {
    return this.hasher.verify(password, encoded);
  }

  needsRehash(encoded: string): boolean {
    return this.hasher.needsRehash(encoded);
  }
}
