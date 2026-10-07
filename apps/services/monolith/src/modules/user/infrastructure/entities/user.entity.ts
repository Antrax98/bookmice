import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  /**
   * UUID y no SERIAL, a diferencia del proyecto `portfolio`. Tres razones que
   * en un sitio de una persona no se notan y aquí sí:
   *
   * El perfil es público, y con un entero `/user/1` se adivisa solo. Un UUID
   * no es secreto, pero elimina el recuento trivial.
   *
   * Los ids numerados filtran quién registra qué: verlos crecer de forma
   * correlativa dice cuántos usuarios hay y en qué orden llegan.
   *
   * Y `users` va a ser la tabla más referenciada del proyecto (reseñas,
   * calificaciones, shelves, comentarios, likes, notificaciones). Un entero
   * son 4 bytes y un UUID 16, pero los índices sobre uuid se comportan como
   * los de texto, así que el ahorro tampoco era el argumento.
   *
   * `@PrimaryColumn` y no `@PrimaryGeneratedColumn`: el id lo genera la
   * aplicación con `randomUUID()`, en `User.createNew`. Con
   * `PrimaryGeneratedColumn` la columna lleva `DEFAULT gen_random_uuid()`,
   * que es justamente lo que se decidió quitar para que el id sea siempre
   * responsabilidad nuestra y exista antes de insertar. `@PrimaryColumn` dice
   * "esta columna es la clave primaria y el valor lo pone el código", que es
   * exactamente lo que pasa.
   */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * 50 y no 100 como en `portfolio`. En Goodreads el username se ve bajo el
   * nombre, y 100 caracteres no caben en ninguna parte de la interfaz.
   *
   * `varchar` y no `citext`: el modelo normaliza a minúsculas al escribir, así
   * que el índice único ya funciona. `citext` sería una segunda defensa, y
   * pagar dos defensas por lo mismo solo tapa el fallo en vez de evitarlo.
   */
  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /**
   * No existe en `portfolio`, porque allí el sitio era de una persona y
   * bastaba con borrar la fila. Goodreads banea y suspende, y borrar se lleva
   * las reseñas con el usuario.
   *
   * Es lo que permitirá que el guard de `auth` rechace a alguien desactivado
   * sin perder su histórico, y lo que hace posible el borrado en diferido.
   *
   * El índice es simple y no compuesto con `email`: la consulta que lo va a
   * necesitar es la del login, que filtra por `email | username` y además por
   * `isActive = true`, y un índice `(is_active, email)` no sirve para ese `OR`:
   * se acabaría sin usarse. El único de email, que es el que sí se usa, ya
   * resuelve.
   */
  @Index('idx_users_is_active')
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
