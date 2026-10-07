/**
 * Las props son la frontera del dominio: lo que entra al modelo y lo que sale.
 *
 * `UserProps` es el usuario ya existente, con identidad y fechas. `UserNewProps`
 * es el alta: solo lo que se escribe. La diferencia no es capricho, es lo que
 * impide que un caso de uso se invente un `id` o una `createdAt`: lo que no
 * está en el tipo no se puede pasar.
 *
 * `id` es `string` y no `number` a propósito. `users` es la tabla más
 * referenciada del proyecto, y en Goodreads el perfil es público: con un
 * entero, `/user/1` se adivina solo y además filtra quién registra qué.
 */
export interface UserProps {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * El alta. **No lleva `id`**: quien crea el usuario no lo elige, lo genera
 * `User.createNew`. Por eso es un tipo aparte de `UserProps` en lugar de un
 * `Pick`: un `Pick` podría dejar el `id` fuera sin querer y el error se vería
 * en la base, no al compilar.
 */
export type UserNewProps = Pick<UserProps, 'username' | 'email' | 'isActive'>;

/**
 * Lo que se escribe en la tabla. Incluye el `id` porque lo genera la
 * aplicación; las fechas NO, porque esas las pone la columna con
 * `DEFAULT now()`. Esa asimetría es intencionada: lo que decide la aplicación
 * se escribe, lo que decide la base se deja.
 */
export type UserWithId = UserNewProps & Pick<UserProps, 'id'>;

/**
 * Filtros de lectura. Todos opcionales y combinados con AND, que es lo que
 * espera `findOne`. El puerto de escritura no los necesita: no se actualiza
 * desde aquí, y una tabla de identidades se cambia poco.
 */
export interface UserFilterProps {
  id?: string;
  email?: string;
  username?: string;
  isActive?: boolean;
}
