import { ApiProperty } from '@nestjs/swagger';
import { MeResult } from '../../application/use-cases/get-me.use-case';

/**
 * La respuesta de `GET /me`.
 *
 * Clase y no `interface` porque Swagger solo lee lo que existe en runtime, y
 * una interfaz desaparece al compilar. El día que esto importara
 * `MeResult` directamente, el contrato saldría con `properties: {}` otra vez.
 *
 * `implements MeResult` ata las dos: si el caso de uso devuelve un campo nuevo y
 * el DTO no, `tsc` lo dice.
 */
export class MeDto implements MeResult {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'lector_prueba' })
  username: string;

  @ApiProperty({ example: 'Lector de Prueba' })
  fullName: string;

  /**
   * Nullable, y **siempre lo va a ser durante un buen rato**: el alta no pide
   * avatar, así que toda cuenta nueva nace con `null`.
   *
   * El cliente tiene que tener un respaldo (iniciales, o un avatar genérico).
   * Un `avatarUrl` que se rompe en un `img` sin `src` no es un caso raro, es
   * el caso normal.
   */
  @ApiProperty({ required: false, nullable: true, example: null })
  avatarUrl: string | null;
}
