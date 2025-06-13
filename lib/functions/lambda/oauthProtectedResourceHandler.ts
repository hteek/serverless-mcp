import createError from 'http-errors';

import {
  createMiddlewareLambdaFunctionURLHandler,
  getLambdaFunctionURLContext,
  getProcessEnv,
  lambdaFunctionURLHandler,
  MiddlewareLambdaFunctionURLHandler,
} from '#middleware';

import { createJsonResponse } from '#utils';

export type MetadataResponse = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
};

export const baseHandler: MiddlewareLambdaFunctionURLHandler = async (
  _event,
  context
) => {
  const { method } = getLambdaFunctionURLContext(context);

  const domainName = getProcessEnv('DOMAIN_NAME', 'no domain name given');

  switch (method) {
    case 'OPTIONS':
      return {
        statusCode: 204,
        headers: { 'Content-Type': 'application/json' },
      };
    case 'GET':
      // Return successful response
      return createJsonResponse<MetadataResponse>(200, {
        authorization_servers: [`https://${domainName}`],
        bearer_methods_supported: ['header'],
        resource: `https://${domainName}`,
        scopes_supported: ['openid', 'profile', 'phone', 'email'],
      });
    default:
      throw new createError.MethodNotAllowed();
  }
};

export const handler = createMiddlewareLambdaFunctionURLHandler(
  baseHandler
).use(
  lambdaFunctionURLHandler({
    methods: ['GET', 'OPTIONS'],
    urlPattern: '/.well-known/oauth-protected-resource',
  })
);
