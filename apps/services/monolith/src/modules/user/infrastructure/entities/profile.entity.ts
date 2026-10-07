import {
  Entity,
  Column,
  PrimaryColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('profiles')
export class ProfileEntity {
  /** Ver `UserEntity.id`: el id lo genera la aplicación, no la columna. */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * Un perfil por usuario, y el índice único es lo que lo garantiza en la
   * base. La regla de "un usuario, un perfil" no se aplica en el modelo: se
   * aplica con esta restricción, que es donde no se puede saltar.
   *
   * SIN foreign key a `users.id`, y sigue siendo decisión deliberada aunque
   * `profile` y `user` vivan ya en el mismo módulo.
   *
   * El coste real está medido: al borrar un usuario sin pasar por el caso de
   * uso, su perfil se queda huérfano en la base, y nada avisa. Se comprobó.
   *
   * A favor: declararla obliga a un `@ManyToOne` que hace que TypeORM incluya
   * la relación en el diff del esquema, y eso ata la integridad referencial a
   * que la entidad la declare. Un esquema que no para de drift es peor que uno
   * sin integridad. La Integrity va en el caso de uso
   * (`CreateUserWithProfileUseCase` usa transacción, y el borrado en cascada será
   * explícito cuando exista `deleteUser`).
   *
   * Lo que sí resuelve es lo importante: `UNIQUE (user_id)` garantiza un
   * perfil por usuario, y la transacción garantiza que no haya un usuario sin
   * perfil. Son las dos invariantes que importan, y las dos las hace cumplir el
   * módulo.
   */
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  location: string | null;

  /**
   * El correo que se muestra a terceros, y no `users.email`, que es el del
   * login. Son cosas distintas: casi nadie quiere que su correo de registro
   * sea público, y el modelo obliga a elegir uno u otro.
   */
  @Column({
    name: 'public_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  publicEmail: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  /**
   * Lo que decide si la lista de lectura es visible. No está en `portfolio`
   * porque allí el único usuario era el dueño.
   *
   * El índice es simple y no compuesto con `user_id`: el único de `user_id`
   * ya resuelve la búsqueda por usuario, que es la que se hace constantemente.
   */
  @Index('idx_profiles_is_private')
  @Column({ name: 'is_private', type: 'boolean', default: false })
  isPrivate: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
