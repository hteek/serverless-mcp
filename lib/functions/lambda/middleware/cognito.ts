import middy, { MiddyfiedHandler } from '@middy/core';
import { getInternal } from '@middy/util';

import { PreTokenGenerationV2TriggerEvent } from 'aws-lambda';
import createError from 'http-errors';

import {
  createTenantMiddleware,
  lambdaHandler,
  MiddlewareContext,
  MiddlewareHandler,
} from './handler.js';
import httpErrorHandler from '@middy/http-error-handler';

export type MiddlewarePreTokenGenerationTriggerHandler =
  MiddlewareHandler<PreTokenGenerationV2TriggerEvent>;
export type MiddyfiedMiddlewarePreTokenGenerationTriggerHandler =
  MiddyfiedHandler<
    PreTokenGenerationV2TriggerEvent,
    unknown,
    Error,
    MiddlewareContext
  >;

export const preTokenGeneration = (): middy.MiddlewareObj => ({
  before: async (request) => {
    const {
      callerContext: { clientId },
      request: {
        userAttributes: { email, sub },
      },
      triggerSource,
    } = request.event as PreTokenGenerationV2TriggerEvent;

    if (!email) {
      throw new Error('no email given');
    }

    if (!sub) {
      throw new Error('no sub given');
    }

    Object.assign(request.internal, {
      clientId,
      email,
      sub,
      triggerSource,
    });

    Object.assign(request.context, {
      cognito: {
        ...(await getInternal(['clientId'], request)),
        ...(await getInternal(['email'], request)),
        ...(await getInternal(['sub'], request)),
        ...(await getInternal(['triggerSource'], request)),
      },
    });
  },
});

const getTenantIdFromEvent = (event: PreTokenGenerationV2TriggerEvent) => {
  const {
    callerContext: { clientId },
  } = event;

  if (!clientId) {
    throw createError(401, 'no tenant id given');
  }
  return clientId;
};

/**
 * Middleware for extracting the tenant ID from Pre Token Generation event.
 * Adds the tenant ID to the internal state and to the request context.
 *
 * @template TResult - The return type of the Lambda handler, defaults to void
 * @returns {middy.MiddlewareObj} A Middy middleware object with a 'before' hook
 * @throws {Error} Throws a 401 error if no tenant ID is found in the event
 */
const tenant = <TResult = void>(): middy.MiddlewareObj<
  PreTokenGenerationV2TriggerEvent,
  TResult
> => createTenantMiddleware(getTenantIdFromEvent);

/**
 * Creates a Pre Token Generation middleware handler.
 * This middleware handler includes logging, metrics, tracing, tenant extraction, STS role assumption, and the Pre Token Generation middleware.
 * @returns {Array} An array of middleware functions
 */
export const preTokenGenerationHandler = (): Array<
  middy.MiddlewareObj<any>
> => [...lambdaHandler(tenant), preTokenGeneration(), httpErrorHandler()];
