import { Global, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Un `DataSource` que existe **solo** para que Nest pueda construir los providers.
 *
 * ## Por qué hace falta
 *
 * `openapi-spec.module.ts` no importa `DatabaseModule`, a propósito: existe para
 * que generar el `openapi.json` no abra conexión con Postgres. Pero `NestFactory`
 * instancia **todos** los providers aunque no se llame a `listen()`, así que los
 * adapters de `infrastructure` tienen que poder construirse, y todos piden
 * `@InjectDataSource()`.
 *
 * Sin este token el fallo es
 * `Nest can't resolve dependencies of the UserEntityRepository (?)`, y hay un
 * agravante que lo hace casi invisible: con `logger: false` en el script, Nest
 * silencia ese error y hace `process.exit(1)` **sin imprimir nada**. El comando
 * falla y no dice por qué.
 *
 * ## Por qué es `@Global()`
 *
 * Porque si no, cada módulo de negocio tendría que importarlo, y eso metería un
 * `DataSource` que no conecta **dentro de los módulos de la aplicación**, donde
 * `DatabaseModule` ya aporta el bueno. Dos fuentes del mismo token, y la
 *dependency resolution elige una según el orden: una mañana, `AppModule` arrancaría
 * con el `DataSource` falso y fallaría al primer login.
 *
 * Global, se importa **una vez**, en `openapi-spec.module.ts`. `AppModule` no lo
 * importa nunca, así que allí el token lo pone `DatabaseModule` y solo él.
 *
 * Es un patrón reservado para el módulo de spec: **no lo uses en `AppModule`**.
 *
 * ## Por qué no conecta
 *
 * Un `DataSource` de TypeORM se construye sin inicializar y su `manager` existe:
 * lo que no existe es la conexión. Aquí no se llama a `initialize()` en ningún
 * momento, así que no hay socket, no hay credenciales y no hay red.
 *
 * Que el objeto se pueda construir es todo lo que Nest necesita. Si algún día una
 * consulta llegara a usar este manager **fallaría**, y sería lo correcto: quiere
 * decir que generar el contrato está tocando la base de datos, que es justo lo
 * que este módulo existe para evitar.
 */
@Global()
@Module({
  providers: [
    {
      provide: DataSource,
      useFactory: (): DataSource =>
        new DataSource({
          type: 'postgres',
          // Host y credenciales **falsos** a propósito: si algo intentara
          // conectar, fallaría en lugar de alcanzar una base real. Poner un
          // `localhost` de verdad sería una invitación.
          host: 'sin-conexion.invalid',
          database: 'sin_conexion',
          username: 'sin_conexion',
          password: 'sin_conexion',
          entities: [],
          synchronize: false,
        }),
    },
  ],
  exports: [DataSource],
})
export class OpenApiDataSourceModule {}
