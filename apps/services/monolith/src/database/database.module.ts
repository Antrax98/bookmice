import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ensureSchema } from './ensure-schema';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      // El factory es asíncrono, y por un motivo concreto: `ensureSchema` tiene
      // que abrir una conexión **antes** de que TypeORM abra la suya, porque
      // pasar `schema` no crea el schema en Postgres. Si el schema no existe,
      // el arranque falla con `relation does not exist`, un error que no
      // menciona el schema por ninguna parte.
      //
      // Es un `CREATE SCHEMA IF NOT EXISTS`, así que en una base ya montada no
      // hace nada y no cuesta más que una consulta.
      useFactory: async (
        configService: ConfigService,
      ): Promise<TypeOrmModuleOptions> => {
        await ensureSchema();

        return {
          type: 'postgres',
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.user'),
          password: configService.get<string>('database.pass'),
          database: configService.get<string>('database.name'),
          // Debe coincidir con el `schema` de `data-source.ts`, o el CLI
          // crearía las tablas en un sitio distinto del que lee la aplicación.
          schema: configService.get<string>('database.schema'),
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
