import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PersistenceScope } from '../domain/persistence-scope.interface';
import { TransactionRunnerPort } from '../domain/transaction-runner.interface';

/**
 * Adapter de `TransactionRunnerPort` sobre el `DataSource` de TypeORM.
 *
 * Y es el **único** sitio del proyecto que importa `DataSource` para abrir una
 * transacción. Los casos de uso piden `TransactionRunnerPort`, que vive en
 * `common/domain` y no sabe qué es Postgres.
 *
 * Ver el docblock del puerto para por qué esto no es un detalle de estilo: sin
 * esta separación, `openapi-spec.module.ts` no puede instanciar los casos de uso
 * y `pnpm gen:openapi` falla.
 */
@Injectable()
export class TypeormTransactionRunnerAdapter implements TransactionRunnerPort {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  run<T>(operacion: (scope: PersistenceScope) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // El scope se construye **una** vez y se pasa tal cual. La identidad del
      // objeto es lo que hace que las dos escrituras caigan en la misma
      // transacción: dos adapters con el mismo manager, o un adapter que
      // ignorase el scope y usara su propia conexión, romperían eso en silencio.
      const scope: PersistenceScope = { save: manager.save.bind(manager) };

      return operacion(scope);
    });
  }
}
