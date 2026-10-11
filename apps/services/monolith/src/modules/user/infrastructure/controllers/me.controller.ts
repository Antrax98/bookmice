import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiTags } from '@nestjs/swagger';
import { ApiEnvelope } from '../../../../common/decorators/api-envelope.decorator';
import type { AuthUser } from '../../../auth/infrastructure/security/auth-user.interface';
import {
  GetMeUseCase,
  type MeResult,
} from '../../application/use-cases/get-me.use-case';
import { MeDto } from './user.dto';

/**
 * `GET /me`: quién está autenticado.
 *
 * Controller propio y no uno compartido con el alta, por la misma regla de ESLint
 * que obliga a un caso de uso por controller.
 *
 * ## Por qué no lleva `@Public()`
 *
 * Porque es lo contrario. Es la única ruta que **depende** de estar
 * autenticado: el guard global ya exige token en todo lo que no sea público, y
 * sin `@Public()` esta ruta lo exige también. Marcarlo sería redundante.
 *
 * ## La ruta es `/me` y no `/profile/me`
 *
 * Para que cuando llegue el perfil público de un usuario, `/profile/:username`,
 * no colisione con un `:username` que valiera `me`. Enrutadores como el de Nest
 * resuelven por orden de declaración, y dos rutas así son una fuente de bugs
 * difíciles de ver: el primero que gana se lleva el caso.
 */
@ApiTags('user')
@Controller('me')
export class MeController {
  constructor(private readonly getMe: GetMeUseCase) {}

  /**
   * `200` implícito: un `GET` que responde bien no necesita decirlo.
   *
   * El `userId` sale de `@CurrentUser()`, no de un parámetro. `@CurrentUser()`
   * lee el `AuthUser` que el guard dejó en el contexto **después** de validar el
   * token, así que para aquí solo puede estar el propio usuario.
   */
  @Get()
  @ApiEnvelope(MeDto)
  async obtenerMe(@CurrentUser() user: AuthUser): Promise<MeResult> {
    return this.getMe.execute({ userId: user.id });
  }
}
