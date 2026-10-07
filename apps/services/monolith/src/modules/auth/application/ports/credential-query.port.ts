import { CredentialProps } from '../../domain/interfaces/credential.interface';

/**
 * Puerto de **LECTURA** de credenciales, en `application/ports/`.
 *
 * Aquí, y no en `domain/ports`, porque no lo necesita ninguna entidad: lo
 * necesita `LoginUseCase`, que es de `application`. Es el mismo criterio que
 * separa los puertos de lectura de `user` de los de escritura.
 *
 * ## Por qué devuelve el hash y no solo un booleano "existe"
 *
 * Porque el login necesita las dos cosas: confirmar que la cuenta existe **y**
 * verificar la contraseña. Un `existePorEmail(): boolean` obligaría al caso de uso
 * a hacer una segunda consulta para traer el hash, y entre las dos preguntas el
 * tiempo de respuesta revelaría si el email está dado de alta.
 *
 * ## Por qué esto NO es un `findByEmail` con el email dentro
 *
 * `findByEmail` devuelve lo que hay para ese correo. Devolver un par
 * `(user, passwordHash)` obliga al que llama a tratar los dos como una unidad,
 * que es lo que son. Un `findByEmail` genérico invita a reutilizarlo para
 * cualquier consulta y a devolver solo el usuario, que es justo lo que
 * `UserQueryPort` ya hace mejor.
 */
export abstract class CredentialQueryPort {
  /**
   * La credencial de ese correo, con su hash. `null` si no hay ninguna.
   *
   * El correo llega normalizado a minúsculas desde `User`: la unicidad de
   * `users.email` no distingue la caja, así que `Ana@correo.com` y
   * `ana@correo.com` son la misma cuenta. Si la comparación se hiciera aquí con
   * la caja, un usuario que se registró en mayúsculas no podría entrar.
   */
  abstract findByEmail(email: string): Promise<CredentialProps | null>;
}
