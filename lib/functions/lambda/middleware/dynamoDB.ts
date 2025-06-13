import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import middy from '@middy/core';
import { getInternal } from '@middy/util';
import { AwsCredentialIdentity } from '@smithy/types';

import { OneSchema, Table } from 'dynamodb-onetable';
import Dynamo from 'dynamodb-onetable/Dynamo';

import { logger } from '#powertools';

import { getProcessEnv } from './util.js';

/**
 * Get the table name from the environment variable
 * @throws {Error} Throws an error if the table name is not set in the environment variables.
 */
export const getTableName = () => getProcessEnv('TABLE', 'no table name given');

export const getTable =
  (client: Dynamo, logger: Logger, name: string, tenantId?: string) =>
  (schema: OneSchema) =>
    new Table({
      client: new Dynamo({ client }),
      logger: (level, message, context) => {
        switch (level) {
          case 'data':
          case 'trace':
            logger.debug(message, context);
            break;
          case 'error':
          case 'exception':
            logger.error(message, context);
            break;
          case 'warn':
            logger.warn(message, context);
            break;
          default:
            logger.info(message, context);
        }
      },
      name,
      partial: false,
      schema,
    }).setContext(tenantId ? { tenantId } : {});

/**
 * Middleware for DynamoDB
 * This middleware retrieves the table name from the environment variables and creates a DynamoDB client.
 * It also adds the table name and a function to get the table to the internal state of the request.
 * @returns {middy.MiddlewareObj} A Middy middleware object with a 'before' hook
 */
export const dynamoDB = (): middy.MiddlewareObj => ({
  before: async (request) => {
    const tableName = getTableName();
    const { credentials, tenantId } = (await getInternal(
      ['credentials', 'tenantId'],
      request
    )) as unknown as {
      credentials: AwsCredentialIdentity;
      tenantId: string;
    };

    const client = new DynamoDBClient({ credentials });

    Object.assign(request.internal, {
      getTable: getTable(new Dynamo({ client }), logger, tableName, tenantId),
      tableName,
    });

    Object.assign(request.context, {
      dynamoDB: {
        ...(await getInternal(['getTable'], request)),
        ...(await getInternal(['tableName'], request)),
      },
    });
  },
});
