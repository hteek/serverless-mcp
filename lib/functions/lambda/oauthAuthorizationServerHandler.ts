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
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
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
      const region = getProcessEnv('AWS_REGION', 'no aws region given');
      const userPoolId = getProcessEnv('USER_POOL_ID', 'no user pool id given');

      const response = await fetch(
        `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/openid-configuration`
      );
      const data = await response.json();

      // Return successful response
      return createJsonResponse<MetadataResponse>(200, {
        ...data,
        authorization_endpoint: `https://${domainName}/oauth/authorize`,
        registration_endpoint: `https://${domainName}/clients`,
        code_challenge_methods_supported: ['S256'],
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
    urlPattern: '/.well-known/oauth-authorization-server',
  })
);
