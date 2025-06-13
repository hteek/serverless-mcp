import { LambdaFunctionURLEvent } from 'aws-lambda';

import { getProcessEnv } from '#middleware';

export const createJsonResponse = <T extends object>(
  statusCode: number,
  body?: T
) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const checkAuthorizationHeader = (
  event: LambdaFunctionURLEvent,
  responseStream: awslambda.HttpResponseStream
) => {
  const { authorization } = event.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    const domainName = getProcessEnv('DOMAIN_NAME', 'no domain name given');
    responseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 401,
      headers: {
        'WWW-Authenticate': `Bearer resource_metadata="https://${domainName}/.well-known/oauth-protected-resource"`,
      },
    });
    responseStream.write(
      JSON.stringify({
        error: 'unauthorized',
        error_description: 'Valid bearer token required',
      })
    );
    responseStream.end();

    return;
  }
};
