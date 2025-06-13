import middy from '@middy/core';

import {
  dynamoDB,
  getCognitoFromContext,
  MiddlewarePreTokenGenerationTriggerHandler,
  MiddyfiedMiddlewarePreTokenGenerationTriggerHandler,
  preTokenGenerationHandler,
} from '#middleware';

import { difference } from 'remeda';

import { Client } from './model/index.js';
import { RegisterClientRequest } from './clientsHandler.js';
import { logger } from '#powertools';

export const baseHandler: MiddlewarePreTokenGenerationTriggerHandler = async (
  event,
  context
) => {
  const { clientId } = getCognitoFromContext(context);
  const { initial_request } = await Client.getById(context, clientId);
  const { scope } = JSON.parse(initial_request) as RegisterClientRequest;
  const scopesToAdd = difference(scope?.split(' ') ?? [], [
    'openid',
    'email',
    'profile',
  ]);

  logger.debug('scopes to add', { scopesToAdd });

  event.response = {
    claimsAndScopeOverrideDetails:
      scopesToAdd.length > 0
        ? {
            accessTokenGeneration: {
              scopesToAdd,
            },
          }
        : {},
  };

  return event;
};

export const handler: MiddyfiedMiddlewarePreTokenGenerationTriggerHandler =
  middy(baseHandler).use(preTokenGenerationHandler()).use(dynamoDB());
