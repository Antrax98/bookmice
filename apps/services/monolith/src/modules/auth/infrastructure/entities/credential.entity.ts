import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('credentials')
export class CredentialEntity {
  /**
   * UUID y no SERIAL, igual que en `user`. Ver `UserEntity.id` para el porqué.
   *
   * Lo genera la aplicación con `randomUUID()`, en el adapter de infraestructura.
   * `CredentialNewProps` no lo trae a propósito: quien crea la credencial no
   * elige el id.
   */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * El usuario dueño de la credencial. `UNIQUE` porque la relación es de uno a
   * uno: un usuario tiene como mucho una credencial, y eso es lo que hace que el
   * login por correo sea único.
   *
   * **Sin foreign key** a `users.id`, aunque las tablas estén en el mismo schema y
   * `users` sea de otro módulo. Es la misma decisión que `profiles.user_id`, y por
   * el mismo motivo: declarar la relación en la entidad obliga a un `@ManyToOne`,
   * que ata la integridad de la base a que la entidad mantenga el import. Si se
   * escribiera a mano en la migración sin declararla, TypeORM no la conoce y
   * cada `migration:generate` posterior propone volver a crearla. Un esquema que
   * no para de drift es peor que uno sin integridad.
   *
   * El coste está medido: un borrado de `users` que no pase por el caso de uso
   * deja la credencial huérfana, y con ella, un `user_id` que ya no existe. No
   * grave: la credencial sola no deja entrar en ninguna parte, porque el guard pide
   * el token a `UserQueryPort` y falla ahí.
   */
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /**
   * El hash, tal cual lo devuelve el hasher.
   *
   * `varchar(255)` y no `text` porque el hash **no** se consulta ni se indexa, y
   * un `text` sin límite invite a guardarlo sin pensar. El scrypt del paquete
   * ocupa alrededor de 100 caracteres con sus parámetros dentro, así que 255 da
   * margen de sobra.
   *
   * Nunca se devuelve fuera de `auth`: el `CredentialQueryPort` es el único que
   * lo trae, y solo lo usa `LoginUseCase`.
   */
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  /**
   * La credencial no se actualiza casi nunca, solo al cambiar la contraseña.
   *
   * Está porque el caso de uso de cambio de contraseña es real y va a llegar, y
   * porque un `updated_at` que no existe obliga a una migración el día que
   * falte. La columna no cuesta nada mientras no se escriba.
   */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
