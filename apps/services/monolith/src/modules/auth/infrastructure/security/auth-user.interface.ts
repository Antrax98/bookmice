/**
 * El usuario que `auth` expone al resto de la aplicación.
 *
 * ## Por qué NO es `UserProps` de `user`
 *
 * Dos razones, y las dos importantes.
 *
 * **La primera, que `auth` no debe exponer el email del login.** El email de
 * `users` es la identidad de acceso. Si el guard dejara el `UserProps` completo en
 * el contexto, cualquier endpoint de perfil podría leerlo, que es justo lo que
 * los dos puertos de lectura de `user` existen para impedir.
 *
 * **La segunda, que este tipo no debería cambiar cuando cambie el de `user`.** Si
 * `auth` importara `UserProps`, añadir un campo a `user` cambiaría el tipo que
 * `auth` publica, y con él todos los consumidores, sin que nadie lo decidiera.
 *
 * ## Los roles
 *
 * `string[]` y no una unión de literales a propósito: los roles los decide cada
 * módulo según su dominio, y un `type Role = 'admin' | 'moderator'` en `auth`
 * obligaría a tocar `auth` cada vez que `review` quiera un rol nuevo. El tipo
 * concreto de cada permiso va en `@nestjs/authorization`, que es donde la
 * pregunta "qué puede hacer este usuario" se responde de verdad.
 *
 * Por eso `emailVerified` es `boolean` y no `Date | null`: la fecha exacta no la
 * necesita ningún consumidor, y `boolean` no obliga a gestionar tres estados.
 */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  emailVerified: boolean;
}
