import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PersistenceScope } from '../../domain/interfaces/persistence-scope.interface';
import {
  UserNewProps,
  UserProps,
} from '../../domain/interfaces/user.interface';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UserRepositoryAdapter implements UserRepositoryPort {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    props: UserNewProps,
    scope?: PersistenceScope,
  ): Promise<UserProps> {
    // Con `scope` se guarda dentro de la transacción del caso de uso; sin él, con
    // la conexión propia. Es el mismo insert en los dos casos: lo único que
    // cambia es en qué transacción cae.
    //
    // El cast es necesario porque `PersistenceScope` declara `save` con una
    // firma mínima y la unión con `EntityManager` no es invocable. El cast es
    // seguro **porque este fichero es la infraestructura**: es el sitio donde
    // se traduce "lo que pide el dominio" a "como lo hace TypeORM". Si algún
    // día el `scope` fuera otra cosa, este es el único punto que hay que
    // cambiar.
    const manager = (scope ?? this.dataSource.manager) as DataSource['manager'];

    return manager.save(UserEntity, props);
  }
}
