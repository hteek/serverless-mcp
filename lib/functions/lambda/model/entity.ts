import { Model, OneSchema, Table } from 'dynamodb-onetable';

import { getDynamoDBFromContext, MiddlewareContext } from '#middleware';

export type ModelName = string | number | symbol;
export type RequiredProperty<T> = {
  [P in keyof T]: Required<NonNullable<T[P]>>;
};

export abstract class BaseEntity {
  static readonly expiresInDays = (days?: number) =>
    Math.floor((Date.now() + (days ?? 30) * 24 * 60 * 60 * 1000) / 1000);

  static readonly getTable: (
    context: MiddlewareContext,
    schema: OneSchema
  ) => Table = (context, schema) =>
    getDynamoDBFromContext(context).getTable(schema);

  static readonly getModel = <T>(
    context: MiddlewareContext,
    schema: OneSchema,
    name: T extends ModelName ? T : ModelName
  ) => BaseEntity.getTable(context, schema).getModel<T>(name) as Model<T>;
}
