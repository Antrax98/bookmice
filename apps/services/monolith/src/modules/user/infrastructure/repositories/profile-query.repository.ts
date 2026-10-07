import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere } from 'typeorm';
import {
  ProfileFilterProps,
  ProfileProps,
} from '../../domain/interfaces/profile.interface';
import { ProfileQueryPort } from '../../application/ports/profile-query.port';
import { ProfileEntity } from '../entities/profile.entity';

@Injectable()
export class ProfileQueryAdapter implements ProfileQueryPort {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findOneProfile(
    filters: ProfileFilterProps,
  ): Promise<ProfileProps | null> {
    return this.dataSource.manager.findOne(ProfileEntity, {
      where: ProfileQueryAdapter.toWhere(filters),
    });
  }

  async countProfiles(filters: ProfileFilterProps): Promise<number> {
    return this.dataSource.manager.count(ProfileEntity, {
      where: ProfileQueryAdapter.toWhere(filters),
    });
  }

  private static toWhere(
    filters: ProfileFilterProps,
  ): FindOptionsWhere<ProfileEntity> {
    return Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined),
    );
  }
}
