import {
  UserFilterProps,
  UserProps,
} from '../../domain/interfaces/user.interface';

/**
 * Puerto de LECTURA. Va en `application/ports/` y no en `domain/` porque la
 * entidad no lo necesita para existir: solo lo usan los casos de uso, que
 * consultan. Esa es la distinción del `AGENTS.md` y la razón de que sean dos
 * ficheros y no uno.
 */
export abstract class UserQueryPort {
  abstract findOneUser(filters: UserFilterProps): Promise<UserProps | null>;

  /**
   * Aparte de `findOneUser` porque aquel compone los filtros con AND y aquí
   * hace falta un OR: el identificador es uno solo y puede ser cualquiera de
   * los dos. Es la consulta del login.
   */
  abstract findOneUserByEmailOrUsername(
    identifier: string,
  ): Promise<UserProps | null>;

  abstract countUsers(filters: UserFilterProps): Promise<number>;
}
