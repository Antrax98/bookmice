import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PersistenceScope } from '../../../../common/domain/persistence-scope.interface';
import {
  ProfileNewProps,
  ProfileProps,
} from '../../domain/interfaces/profile.interface';
import { ProfileRepositoryPort } from '../../domain/ports/profile-repository.port';
import { ProfileEntity } from '../entities/profile.entity';

@Injectable()
export class ProfileRepositoryAdapter implements ProfileRepositoryPort {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    props: ProfileNewProps,
    scope?: PersistenceScope,
  ): Promise<ProfileProps> {
    // Mismo criterio que en `UserRepositoryAdapter`: aquí es donde se traduce el
    // `PersistenceScope` del dominio al `EntityManager` de TypeORM.
    const manager = (scope ?? this.dataSource.manager) as DataSource['manager'];

    return manager.save(ProfileEntity, props);
  }
}
