import {
  ProfileFilterProps,
  ProfileProps,
} from '../../domain/interfaces/profile.interface';

/**
 * Puerto de LECTURA, en `application/ports/`: lo necesitan los casos de uso,
 * no la entidad. Ver la distinción del `AGENTS.md`.
 */
export abstract class ProfileQueryPort {
  abstract findOneProfile(
    filters: ProfileFilterProps,
  ): Promise<ProfileProps | null>;

  abstract countProfiles(filters: ProfileFilterProps): Promise<number>;
}
