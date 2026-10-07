import { Injectable } from '@nestjs/common';
import { TokenService } from '@nestjs/authentication';
import { UserQueryPort } from '../../../user/application/ports/user-query.port';
import { UnauthenticatedException } from '../../../../common/exceptions/unauthenticated.exception';
import { CredentialQueryPort } from '../ports/credential-query.port';
import { PasswordHasherPort } from '../ports/password-hasher.port';

/** Lo que devuelve un login correcto. */
export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

/**
 * Login con correo y contraseña.
 *
 * ## El mensaje de error es el mismo en los dos fallos
 *
 * "Correo no existe" y "contraseña incorrecta" responden exactamente lo mismo, y
 * no por descuido: si diferenciaran, bastaría un formulario de login para
 * enumerar qué correos están dados de alta en Goodreads, que es información de
 * valor.
 *
 * Por eso el `PasswordHasherPort.verify` acepta `null` y `undefined`: cuando no
 * hay credencial, se verifica **contra un hash inexistente** para que el hasher
 * haga su trabajo normal. Si devolviera `false` al instante, el **tiempo** de la
 * respuesta revelaría lo mismo que el mensaje.
 *
 * ## Por qué no se valida la contraseña con `Password.create`
 *
 * Porque `Password` valida las reglas del **alta**: mínimo 12 caracteres. En el
 * login, una contraseña de 8 que se puso con una regla anterior tiene que seguir
 * funcionando, o el usuario se queda fuera de su cuenta sin poder entrar por
 * ninguna vía. El paquete distingue esto también: el `SignUpDto` exige el
 * mínimo y el `SignInDto` no.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly credentialReads: CredentialQueryPort,
    private readonly users: UserQueryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly tokens: TokenService,
  ) {}

  async execute(params: {
    email: string;
    password: string;
  }): Promise<LoginResult> {
    const credencial = await this.credentialReads.findByEmail(params.email);

    // Verificar **siempre**, exista la cuenta o no. Con `null` el hasher hace el
    // trabajo completo contra un hash señuelo, que es lo que iguala el tiempo de
    // respuesta. Es el detalle que hace que el mensaje genérico de abajo sirva de
    // algo: sin esto, el mensaje seguiría siendo el mismo pero el tiempo no.
    const coincide = await this.hasher.verify(
      params.password,
      credencial?.passwordHash,
    );

    if (!credencial || !coincide) {
      // Un solo mensaje para los dos casos, a propósito.
      throw new UnauthenticatedException('Invalid email or password');
    }

    // La cuenta existe y la contraseña es correcta. Falta comprobar que la
    // cuenta esté activa: `users.is_active` existe para eso.
    //
    // Va **después** de verificar la contraseña, y no antes, por el mismo motivo
    // del timing: si una cuenta desactivada respondiera más rápido, el atacante
    // sabría que el correo existe aunque la contraseña fuese falsa.
    const usuario = await this.users.findOneUser({
      id: credencial.userId,
    });

    if (!usuario || !usuario.isActive) {
      throw new UnauthenticatedException('Invalid email or password');
    }

    // `amr` (authentication methods references) deja constancia de **cómo** se
    // autenticó. El paquete lo usa para saber si un token tiene segundo factor,
    // así que no es decorativo: si más adelante se añade MFA, un token emitido
    // aquí (`pwd` a secas) no contará como verificado.
    const pareja = await this.tokens.issue(usuario.id, {
      method: 'password',
      claims: { amr: ['pwd'] },
    });

    return {
      accessToken: pareja.accessToken,
      // En **segundos**, aunque el resto de duraciones del paquete vaya en
      // milisegundos. Es lo que dice la interfaz `TokenPair` y lo que espera un
      // cliente móvil para saber cuándo tiene que renovar.
      expiresIn: pareja.expiresIn,
      refreshToken: pareja.refreshToken,
    };
  }
}
