import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { UserQueryPort } from '../../../user/application/ports/user-query.port';
import { AuthUser } from './auth-user.interface';

/**
 * Verifica el `Authorization: Bearer <jwt>` y devuelve el usuario.
 *
 * ## Lo que hace el paquete y lo que hacemos nosotros
 *
 * El paquete verifica **todo** lo criptográfico: firma, `iss`, `aud`, `exp`,
 * `nbf`, `typ` y que el `alg` sea el esperado. Eso no se toca ni se repite, y es
 * lo que evita los ataques clásicos: cambiar el algoritmo a `none`, o poner `alg:
 * HS256` con la clave pública como secreto.
 *
 * Lo único que nos toca es `validate()`, que se llama **después** de que la
 * firma haya pasado, y que carga el usuario desde la base.
 *
 * ## Por qué `validate()` vuelve a consultar la base
 *
 * Porque un token es una foto. Si el usuario se borró, cambió su email o se le
 * cerró la cuenta hace un minuto, el token sigue siendo criptográficamente
 * válido. Volver a leerlo en cada petición es lo que hace que la baja surta
 * efecto de inmediato y no cuando caduque el token.
 *
 * ## Por qué devuelve `null` y no lanza
 *
 * `null` significa "este token no identifica a nadie" y la respuesta es un 401.
 * Lanzar sería una excepción de más por un caso esperado: el usuario fue borrado.
 *
 * ## Por qué se registra a sí mismo en el constructor
 *
 * Porque el orden en que Nest construye los providers sigue el grafo de módulos,
 * y ese orden cambia cuando un provider se mueve de módulo o se añade un import.
 * El orden de la cadena de autenticación se declara al registrarse, no se deduce
 * del grafo.
 */
@Injectable()
export class JwtAuth extends JwtBearerProvider<AuthUser> {
  constructor(
    private readonly users: UserQueryPort,
    registry: AuthenticationRegistry,
  ) {
    // `realm` va en el `WWW-Authenticate` del 401, para que el cliente sepa qué
    // acepta esta API. Es lo que recibe un cliente cuando su token caduca.
    super({ realm: 'bookmice' });

    // Se registra a sí mismo. Sin esta línea, el guard avisa al arrancar que no
    // hay ningún provider y responde 401 a todo lo que no sea `@Public()`.
    registry.registerProvider(this);
  }

  async validate({ sub }: JwtClaims): Promise<AuthUser | null> {
    // `sub` es el `userId` que puso `TokenService.issue()`. Sin él, el token no
    // dice de quién es: se rechaza, y no con una excepción.
    if (!sub) return null;

    const usuario = await this.users.findOneUser({ id: sub });
    if (!usuario) return null;

    // El mapa es explícito y no un `return usuario`. `AuthUser` es **otro** tipo
    // a propósito: si algún día `users` gana una columna, no debe colarse sola
    // en lo que `auth` publica. Ver `AuthUser`.
    //
    // `emailVerified` es `false` mientras no haya verificación de correo, que es
    // la fase 1. En la fase 2 sale de la fila del usuario.
    return {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      roles: [],
      emailVerified: false,
    };
  }
}
