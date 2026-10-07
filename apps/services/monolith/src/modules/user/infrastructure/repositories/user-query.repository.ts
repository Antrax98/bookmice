import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere } from 'typeorm';
import {
  UserFilterProps,
  UserProps,
} from '../../domain/interfaces/user.interface';
import { UserQueryPort } from '../../application/ports/user-query.port';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UserQueryAdapter implements UserQueryPort {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findOneUser(filters: UserFilterProps): Promise<UserProps | null> {
    return this.dataSource.manager.findOne(UserEntity, {
      where: UserQueryAdapter.toWhere(filters),
    });
  }

  /**
   * La consulta del login.
   *
   * Filtra también por `isActive`. Sin eso, un usuario baneado podría entrar
   * igual: el guard no tendría cómo distinguirlo, porque el token es válido.
   * Que el descarte esté en la propia consulta y no en el servicio es lo que
   * lo hace difícil de olvidar al añadir otro endpoint de autenticación.
   */
  async findOneUserByEmailOrUsername(
    identifier: string,
  ): Promise<UserProps | null> {
    // Los dos se guardan ya en minúsculas, así que basta con comparar igual y
    // la consulta aprovecha los índices únicos de ambas columnas.
    const limpio = identifier.trim().toLowerCase();

    // Un array en el `where` es un OR en TypeORM.
    return this.dataSource.manager.findOne(UserEntity, {
      where: [
        { email: limpio, isActive: true },
        { username: limpio, isActive: true },
      ],
    });
  }

  async countUsers(filters: UserFilterProps): Promise<number> {
    return this.dataSource.manager.count(UserEntity, {
      where: UserQueryAdapter.toWhere(filters),
    });
  }

  /**
   * Los filtros son todos opcionales, y los `undefined` se quitan porque
   * TypeORM los interpreta como `= NULL`, que no es lo mismo que "no filtrar".
   */
  private static toWhere(
    filters: UserFilterProps,
  ): FindOptionsWhere<UserEntity> {
    return Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined),
    );
  }
}
