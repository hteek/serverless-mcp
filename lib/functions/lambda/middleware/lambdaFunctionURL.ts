import middy, { MiddyfiedHandler } from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import { getInternal } from '@middy/util';

import {
  LambdaFunctionURLEvent,
  LambdaFunctionURLHandler,
  LambdaFunctionURLResult,
} from 'aws-lambda';
import createError from 'http-errors';
import UrlPattern from 'url-pattern';

import {
  createMiddlewareHandler,
  createTenantMiddleware,
  lambdaHandler,
  MiddlewareContext,
} from './handler.js';

export type LambdaFunctionURLOpts = {
  methods?: (
    | 'DELETE'
    | 'GET'
    | 'HEAD'
    | 'OPTIONS'
    | 'PATCH'
    | 'POST'
    | 'PUT'
  )[];
  urlPattern: string;
};

/**
 * Validates HTTP method and path of a Lambda Function URL Event.
 * Checks if the method is allowed and the path matches a defined pattern.
 *
 * @template T - The type of parameters extracted from the path, defaults to an object with an 'id' property
 * @param {LambdaFunctionURLEvent} event - The event containing HTTP method and path
 * @param {string} allowedPath - The allowed path pattern
 * @param {string[]} [allowedMethods] - Optional array of allowed HTTP methods
 * @returns {{ method: string; params: T; path: string }} Object containing the method, extracted parameters, and path
 * @throws {Error} 405 error if method is not allowed, 404 error if path is not found
 */
export const checkHttpMethodAndPath = <TParams = { id: string }>(
  event: LambdaFunctionURLEvent,
  allowedPath: string,
  allowedMethods?: string[]
): { method: string; params: TParams; path: string } => {
  const {
    http: { method, path },
  } = event.requestContext;
  if (allowedMethods && !allowedMethods.some((value) => value === method)) {
    throw createError(405, `Method ${method} not allowed for ${path}`);
  }
  const pattern = new UrlPattern(allowedPath);
  if (pattern && pattern.match(path) === null) {
    throw createError(404, `Path ${path} not found`);
  }
  const params = pattern.match(path) as TParams;
  return {
    method,
    params,
    path,
  };
};

export const getBodyFromEvent = <T = unknown>(event: LambdaFunctionURLEvent) =>
  JSON.parse(event.body ? event.body : '{}') as T;

const getTenantIdFromEvent = (event: LambdaFunctionURLEvent) => {
  const { headers } = event;
  const tenantId =
    headers['api-key'] ||
    headers['authorization'] ||
    headers['bearer'] ||
    'public';

  if (!tenantId) {
    throw createError(401, 'no tenant id given');
  }
  return tenantId;
};

/**
 * Middleware for extracting the tenant ID from Lambda Function URL event.
 * Adds the tenant ID to the internal state and to the request context.
 *
 * @template TResult - The return type of the Lambda handler, defaults to void
 * @returns {middy.MiddlewareObj} A Middy middleware object with a 'before' hook
 * @throws {Error} Throws a 401 error if no tenant ID is found in the event
 */
const tenant = <TResult = void>(): middy.MiddlewareObj<
  LambdaFunctionURLEvent,
  TResult
> => createTenantMiddleware(getTenantIdFromEvent);

/**
 * Middleware for Lambda Function URL.
 * This middleware checks the HTTP method and path of the event against allowed methods and a URL pattern.
 * It also extracts the method and parameters from the event and adds them to the request context.
 * @param opts - Options for the middleware, including allowed methods and URL pattern
 */
const lambdaFunctionURL = <TParams = { id: string }, TResult = void>(
  opts: LambdaFunctionURLOpts
): middy.MiddlewareObj<LambdaFunctionURLEvent, TResult> => ({
  before: async (request) => {
    const { context, internal, event } = request;
    const { methods, urlPattern } = opts;
    const { method, params } = checkHttpMethodAndPath<TParams>(
      event,
      urlPattern,
      methods
    );

    Object.assign(internal, {
      getBodyFromEvent,
      method,
      params,
    });

    Object.assign(context, {
      lambdaFunctionURL: {
        ...(await getInternal(['getBodyFromEvent'], request)),
        ...(await getInternal(['method'], request)),
        ...(await getInternal(['params'], request)),
      },
    });
  },
});

/**
 * Creates a Lambda Function URL middleware handler.
 * This middleware handler includes logging, metrics, tracing, tenant extraction, STS role assumption, and the Lambda Function URL middleware.
 * @param opts - Options for the Lambda Function URL middleware, including allowed methods and URL pattern
 * @returns {Array} An array of middleware functions
 */
export const lambdaFunctionURLHandler = <
  TParams = { id: string },
  TResult = void,
>(
  opts: LambdaFunctionURLOpts
): Array<middy.MiddlewareObj<any>> => [
  ...lambdaHandler(tenant),
  lambdaFunctionURL<TParams, TResult>(opts),
  httpErrorHandler(),
];

export type MiddlewareLambdaFunctionURLHandler<T = never> =
  LambdaFunctionURLHandler<T> extends (
    event: infer E,
    context: infer _,
    callback: infer C
  ) => infer R
    ? (event: E, context: MiddlewareContext, callback: C) => R
    : never;

export type MiddyfiedMiddlewareLambdaFunctionURLHandler<T = never> =
  MiddyfiedHandler<
    LambdaFunctionURLEvent,
    LambdaFunctionURLResult<T>,
    Error,
    MiddlewareContext
  >;

/**
 * Creates a Middyfied Lambda Function URL handler.
 * @param handler The Lambda Function URL handler to be wrapped.
 */
export const createMiddlewareLambdaFunctionURLHandler: <T = never>(
  handler: MiddlewareLambdaFunctionURLHandler<T>
) => MiddyfiedMiddlewareLambdaFunctionURLHandler<T> = <T = never>(
  handler: MiddlewareLambdaFunctionURLHandler<T>
) => createMiddlewareHandler(handler);
