import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import { CreateUserPoolClientCommandOutput } from '@aws-sdk/client-cognito-identity-provider';
import middy, { MiddyfiedHandler } from '@middy/core';
import { getInternal } from '@middy/util';

import { Context, Handler, LambdaFunctionURLEvent } from 'aws-lambda';
import { OneSchema, Table } from 'dynamodb-onetable';

import { logger, metrics, tracer } from '#powertools';

import { sts } from './sts.js';

export type CognitoContext = {
  clientId: string;
  email: string;
  sub: string;
  triggerSource: string;
};

export type CognitoIdentityProviderContext = {
  allowedScopes: string[];
  clientName: string;
  redirect_uris: string[];
  createClient: (
    clientName: string,
    redirect_uris: string[]
  ) => Promise<CreateUserPoolClientCommandOutput>;
  userPoolId: string;
};

export type DynamoDBContext = {
  getTable: (schema: OneSchema) => Table;
  tableName: string;
};

export type LambdaFunctionURLContext<TParams = { id: string }> = {
  getBodyFromEvent: <T = unknown>(event: LambdaFunctionURLEvent) => T;
  method: string;
  params: TParams;
};

export type MiddlewareContext = Context & {
  cognito?: CognitoContext;
  cognitoIdentityProvider?: CognitoIdentityProviderContext;
  tenantId?: string;
  dynamoDB?: DynamoDBContext;
  lambdaFunctionURL?: LambdaFunctionURLContext;
};

const getFromContext = <T>(
  context: MiddlewareContext,
  key: keyof MiddlewareContext
): T => {
  const result = context[key];
  if (!result) {
    throw new Error(`${key} not found in context`);
  }
  return result as T;
};

export const getCognitoFromContext = (context: MiddlewareContext) =>
  getFromContext<CognitoContext>(context, 'cognito');
export const getCognitoIdentityProviderFromContext = (
  context: MiddlewareContext
) =>
  getFromContext<CognitoIdentityProviderContext>(
    context,
    'cognitoIdentityProvider'
  );
export const getTenantIdContext = (context: MiddlewareContext) =>
  getFromContext<string>(context, 'tenantId');
export const getDynamoDBFromContext = (context: MiddlewareContext) =>
  getFromContext<DynamoDBContext>(context, 'dynamoDB');
export const getLambdaFunctionURLContext = <TParams = { id: string }>(
  context: MiddlewareContext
) =>
  getFromContext<LambdaFunctionURLContext<TParams>>(
    context,
    'lambdaFunctionURL'
  );

export const createTenantMiddleware = <TEvent, TResult>(
  getTenantId: (event: TEvent) => string
): middy.MiddlewareObj<TEvent, TResult> => ({
  before: async (request) => {
    const { context, event, internal } = request;
    Object.assign(internal, {
      tenantId: getTenantId(event),
    });

    Object.assign(context, {
      ...(await getInternal(['tenantId'], request)),
    });
  },
});

/**
 * Provides a set of common middleware functions for AWS Lambda handlers.
 * This middleware handler includes logging, metrics, tracing, tenant extraction and STS role assumption.
 * @returns {Array} An array of middleware functions
 */
export const lambdaHandler = (
  tenant: () => middy.MiddlewareObj<any>
): Array<middy.MiddlewareObj<unknown>> => [
  logMetrics(metrics),
  injectLambdaContext(logger, {
    logEvent: true,
    resetKeys: true,
  }),
  // Since we are returning multiple items and the X-Ray segment limit is 64kb, we disable response capture to avoid data loss
  captureLambdaHandler(tracer, { captureResponse: false }),
  tenant(),
  sts(),
];

export type MiddlewareHandler<TEvent = unknown, TResult = unknown> =
  Handler<TEvent, TResult> extends (
    event: infer E,
    context: infer _,
    callback: infer C
  ) => infer R
    ? (event: E, context: MiddlewareContext, callback: C) => R
    : never;

export type MiddyfiedMiddlewareHandler<
  TEvent = unknown,
  TResult = unknown,
> = MiddyfiedHandler<TEvent, TResult, Error, MiddlewareContext>;

export const createMiddlewareHandler: <TEvent = unknown, TResult = unknown>(
  handler: MiddlewareHandler<TEvent, TResult>,
  streamifyResponse?: boolean
) => MiddyfiedMiddlewareHandler<TEvent, TResult> = <TEvent, TResult>(
  handler: MiddlewareHandler<TEvent, TResult>,
  streamifyResponse = false
) => middy(handler, { streamifyResponse });
