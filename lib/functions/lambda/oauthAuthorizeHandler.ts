import createError from 'http-errors';

import {
  createMiddlewareLambdaFunctionURLHandler,
  getLambdaFunctionURLContext,
  getProcessEnv,
  lambdaFunctionURLHandler,
  MiddlewareLambdaFunctionURLHandler,
} from '#middleware';
import { logger } from '#powertools';

export type MetadataResponse = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
};

export const baseHandler: MiddlewareLambdaFunctionURLHandler = async (
  event,
  context
): Promise<{ statusCode: number; headers: Record<string, string> }> => {
  const { method } = getLambdaFunctionURLContext(context);

  switch (method) {
    case 'OPTIONS':
      return {
        statusCode: 204,
        headers: { 'Content-Type': 'application/json' },
      };
    case 'GET':
      const region = getProcessEnv('AWS_REGION', 'no aws region given');
      const userPoolId = getProcessEnv('USER_POOL_ID', 'no user pool id given');

      const response = await fetch(
        `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/openid-configuration`
      );
      const { authorization_endpoint } = await response.json();

      const params = event.queryStringParameters ?? {};
      delete params.scope;
      const authorizationUrl = `${authorization_endpoint}?${new URLSearchParams(params as Record<string, string>).toString()}`;
      logger.info('oauth authorization url', { authorizationUrl });
      return {
        statusCode: 302,
        headers: { Location: authorizationUrl },
      };
    default:
      throw new createError.MethodNotAllowed();
  }
};

export const handler = createMiddlewareLambdaFunctionURLHandler(
  baseHandler
).use(
  lambdaFunctionURLHandler({
    methods: ['GET'],
    urlPattern: '/oauth/authorize',
  })
);
