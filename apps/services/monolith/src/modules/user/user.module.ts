import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileQueryPort } from './application/ports/profile-query.port';
import { UserQueryPort } from './application/ports/user-query.port';
import { userProviders } from './composition/container';
import { ProfileEntity } from './infrastructure/entities/profile.entity';
import { UserEntity } from './infrastructure/entities/user.entity';

/**
 * Superficie Nest del módulo `user`.
 *
 * Un módulo, dos entidades. `users` es identidad de acceso y `profiles` cara
 * pública, y son tablas distintas porque lo que se expone a terceros no debe
 * incluir el correo del login. Esa separación es de **datos**, no de módulos:
 * por eso los dos puertos de lectura se exportan por separado.
 *
 * `ProfileQueryPort` lo necesitará `review` (el nombre y el avatar de quien
 * escribe una reseña) y `UserQueryPort` lo necesitará `auth` (el login busca
 * por email o username). Siempre por el puerto, nunca importando el modelo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, ProfileEntity])],
  controllers: [],
  providers: userProviders,
  exports: [UserQueryPort, ProfileQueryPort],
})
export class UserModule {}
