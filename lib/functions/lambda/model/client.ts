import { Entity, Model } from 'dynamodb-onetable';

import { MiddlewareContext } from '#middleware';

import { BaseEntity } from './entity.js';
import { schema } from './schema.js';

export type ClientType = Entity<typeof schema.models.Client>;

export class Client extends BaseEntity {
  static readonly getClientModel: (
    context: MiddlewareContext
  ) => Model<Entity<ClientType extends Entity<infer X> ? X : never>> = (
    context: MiddlewareContext
  ) => Client.getModel<ClientType>(context, schema, 'Client');

  static readonly create: (
    context: MiddlewareContext,
    client_id: string,
    client_metadata: string,
    initial_request: string
  ) => Promise<Entity<ClientType extends Entity<infer X> ? X : never>> = async (
    context: MiddlewareContext,
    client_id: string,
    client_metadata: string,
    initial_request: string
  ) =>
    Client.getClientModel(context).create(
      {
        client_id,
        client_metadata,
        initial_request,
        registration_time: Date.now(),
      },
      { log: true }
    );

  static readonly getById: (
    context: MiddlewareContext,
    client_id: string
  ) => Promise<ClientType> = async (
    context: MiddlewareContext,
    client_id: string
  ) =>
    Client.getClientModel(context)
      .get({ client_id }, { log: true })
      .then((client?: ClientType) => {
        if (!client) {
          throw new Error(`no client found with id: ${client_id}`);
        }

        return client;
      });
}
