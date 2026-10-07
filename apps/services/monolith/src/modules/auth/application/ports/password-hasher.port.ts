/**
 * Puerto del hasher de contraseñas, en `application/ports/`.
 *
 * ## Este puerto existe por una razón concreta, no por simetría
 *
 * scrypt con `logN: 17` son **128 MiB y casi un segundo por hash**, en el
 * threadpool de libuv, que tiene cuatro hilos. Los tests de `RegisterUseCase` y
 * `LoginUseCase` necesitarían hashear, y con el hasher real:
 *
 * - cada test tardaría un segundo, y hay varios por caso de uso
 * - el proceso se comería cientos de MiB de golpe
 * - con cuatro hilos, dos tests en paralelo bloquean los demás
 *
 * Con el puerto, los tests meten un hasher falso que devuelve `hash:plain`, y
 * tardan lo que tarda el resto. El adapter real solo se usa en la prueba de
 * integración contra Postgres, que es donde tiene sentido.
 *
 * ## Por qué `verify` acepta `undefined`
 *
 * A propósito, y es el detalle que evita que el login revele qué emails existen.
 *
 * Cuando el correo no está dado de alta hay que **responder igual de tarde** que
 * cuando está pero la contraseña es incorrecta. Si `verify` con `undefined`
 * devolviera `false` al instante, la diferencia de tiempo bastaría para enumerar
 * las cuentas registradas. Con el hash inexistente, el hasher hace su trabajo
 * normal y el coste es el mismo.
 *
 * Por eso el parámetro es `string | null | undefined` y no `string`: el caso
 * "no hay credencial" tiene que poder llegar al hasher.
 */
export abstract class PasswordHasherPort {
  /**
   * Devuelve el hash listo para guardar.
   *
   * **Nunca** registrar ni devolver lo que entra aquí en claro.
   */
  abstract hash(password: string): Promise<string>;

  /**
   * Comparación en tiempo constante.
   *
   * `encoded` en `null` o `undefined` significa "esta cuenta no tiene
   * credencial", y **no** es un atajo para devolver `false` sin trabajar: ver la
   * nota de arriba sobre enumeración de cuentas.
   */
  abstract verify(
    password: string,
    encoded: string | null | undefined,
  ): Promise<boolean>;

  /**
   * `true` cuando el hash guardado usa parámetros más débiles que los
   * configurados.
   *
   * El hash de scrypt es autodescriptivo (`$scrypt$ln=17,r=8,p=1$salt$hash`), así
   * que subir `logN` no invalida los hashes viejos: se pueden rehashear en el
   * siguiente login, cuando el usuario acaba de dar la contraseña en claro.
   *
   * **Síncrono a propósito**, aunque `hash` y `verify` sean asíncronos. El coste
   * real de `needsRehash` es parsear el prefijo del hash, que no usa CPU: no hay
   * nada que esperar. Y un puerto devuelve `Promise` donde tiene que esperar, no
   * por simetría.
   *
   * No está en la primera entrega porque no hay caso de uso que lo llame todavía.
   * Viene con "cambiar contraseña" y con la subida de `logN`.
   */
  abstract needsRehash(encoded: string): boolean;
}
