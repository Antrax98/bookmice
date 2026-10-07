import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import {
  CredentialNewProps,
  CredentialProps,
} from '../../domain/interfaces/credential.interface';
import { CredentialRepositoryPort } from '../../domain/ports/credential-repository.port';
import { CredentialEntity } from '../entities/credential.entity';

@Injectable()
export class CredentialRepositoryAdapter implements CredentialRepositoryPort {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    props: CredentialNewProps,
    scope?: PersistenceScope,
  ): Promise<CredentialProps> {
    // El id lo pone la aplicación, no la columna: `CredentialNewProps` no lo trae
    // a propósito, y la columna no lleva `DEFAULT`. Es el mismo acuerdo que
    // `users.id` y `profiles.id`.
    const entity = new CredentialEntity();
    entity.id = randomUUID();
    entity.userId = props.userId;
    entity.passwordHash = props.passwordHash;

    // Con `scope` se guarda dentro de la transacción del caso de uso; sin él,
    // con la conexión propia. Es el mismo insert en los dos casos.
    //
    // El cast es necesario porque `PersistenceScope` declara `save` con una firma
    // mínima y la unión con `EntityManager` no es invocable. Es seguro **porque
    // este fichero es la infraestructura**: es donde se traduce "lo que pide el
    // dominio" a "como lo hace TypeORM".
    const manager = (scope ?? this.dataSource.manager) as DataSource['manager'];

    // Se pasa la entidad y no un literal plano, porque el `id` ya viene puesto.
    // Con un literal, TypeORM no sabría que es un insert y no un update.
    const guardada = await manager.save(CredentialEntity, entity);

    return {
      id: guardada.id,
      userId: guardada.userId,
      passwordHash: guardada.passwordHash,
      createdAt: guardada.createdAt,
      updatedAt: guardada.updatedAt,
    };
  }
}
