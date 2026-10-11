import { Injectable } from '@nestjs/common';
import { ResourceNotFoundException } from '../../../../common/exceptions/resource-not-found.exception';
import { ProfileQueryPort } from '../ports/profile-query.port';
import { UserQueryPort } from '../ports/user-query.port';

/**
 * Lo mínimo para pintar "quién soy" en la interfaz.
 *
 * Deliberadamente corto. Un endpoint `me` que devuelve la fila entera de
 * `profiles` acabaría sirviendo para extraer el email público o la biografía
 * desde la barra de navegación, que es justo lo que los dos puertos de lectura
 * de `user` existen para impedir.
 *
 * Cuando haga falta más, se añaden campos **a propósito** y con su razón, no
 * porque ya estaban en la tabla.
 */
export interface MeResult {
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

/**
 * Quién está autenticado, según el token que ya validó el guard.
 *
 * El `userId` **no llega del controller como dato libre**, sino de `@CurrentUser()`,
 * que es lo que el guard dejó después de verificar el token. Un endpoint `me` que
 * aceptara un id por parámetro sería un endpoint para leer el perfil de otro.
 *
 * ## Por qué dos puertos y no uno
 *
 * El nombre está en `users` y el nombre y el avatar en `profiles`. Son dos
 * tablas distintas por una razón concreta, y leerlas por un solo puerto
 * borraría esa separación de paso.
 *
 * ## Por qué `Promise.all` y no secuencial
 *
 * Son dos lecturas independientes sobre la misma fila lógica. Va en paralelo
 * porque no hay nada que una dependa de la otra, y porque el navbar se pinta en
 * cada carga de la portada.
 */
@Injectable()
export class GetMeUseCase {
  constructor(
    private readonly users: UserQueryPort,
    private readonly profiles: ProfileQueryPort,
  ) {}

  /**
   * @param params.userId El `id` del `AuthUser` que dejó el guard en el contexto.
   */
  async execute(params: { userId: string }): Promise<MeResult> {
    const [user, profile] = await Promise.all([
      this.users.findOneUser({ id: params.userId }),
      this.profiles.findOneProfile({ userId: params.userId }),
    ]);

    /**
     * Un usuario sin perfil no es un estado válido —la alta los escribe juntos en
     * una transacción—, así que llegar aquí significa que alguien escribió por
     * fuera del caso de uso. Se dice con un 404 en vez de devolver medio usuario,
     * porque un `MeResult` a medias sería peor que un error: el cliente lo
     * dibujaría sin avisar.
     */
    if (!user || !profile) {
      throw new ResourceNotFoundException(
        'El usuario autenticado no tiene perfil asociado.',
      );
    }

    return {
      userId: user.id,
      username: user.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
    };
  }
}
