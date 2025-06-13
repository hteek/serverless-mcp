import createHttpError from 'http-errors';

import {
  cognitoIdentityProvider,
  createMiddlewareLambdaFunctionURLHandler,
  dynamoDB,
  getCognitoIdentityProviderFromContext,
  getLambdaFunctionURLContext,
  lambdaFunctionURLHandler,
  MiddlewareLambdaFunctionURLHandler,
} from '#middleware';
import { Client } from '#model';
import { createJsonResponse } from '#utils';
import { unique } from 'remeda';

export type RegisterClientRequest = {
  redirect_uris: string[];
  client_name: string;
  scope: string;
};

export type RegisterClientResponse = {
  client_id: string;
  client_secret: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
  response_types: string[];
  client_name: string;
  scope: string;
};

export const baseHandler: MiddlewareLambdaFunctionURLHandler = async (
  event,
  context
) => {
  const { getBodyFromEvent } = getLambdaFunctionURLContext(context);
  const client = getBodyFromEvent<RegisterClientRequest>(event);
  const { client_name, redirect_uris, scope } = client;
  // Validate required fields
  if (
    !redirect_uris ||
    !Array.isArray(redirect_uris) ||
    redirect_uris.length === 0
  ) {
    return createJsonResponse(400, {
      error: 'invalid_redirect_uri',
      error_description: 'redirect_uris is required and must be an array',
    });
  }

  // Determine client name
  const clientName = client_name || `dcr-client-${Date.now()}`;

  const { createClient } = getCognitoIdentityProviderFromContext(context);
  // Create client in Cognito
  const { UserPoolClient } = await createClient(clientName, redirect_uris);

  if (!UserPoolClient || UserPoolClient?.ClientId === undefined) {
    throw new createHttpError.InternalServerError(
      'Error creating client registration'
    );
  }

  // Construct client registration response
  const registrationResponse: RegisterClientResponse = {
    client_id: UserPoolClient?.ClientId,
    client_secret: UserPoolClient?.ClientSecret ?? '',
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0, // Never expires
    redirect_uris,
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'client_secret_basic',
    response_types: ['code'],
    client_name: clientName,
    scope: unique([
      ...(scope?.split(' ') ?? []),
      ...(UserPoolClient?.AllowedOAuthScopes ?? []),
    ]).join(' '),
  };

  await Client.create(
    context,
    UserPoolClient.ClientId,
    JSON.stringify(registrationResponse),
    JSON.stringify(client)
  );

  // Return successful response
  return createJsonResponse<RegisterClientResponse>(201, registrationResponse);
};

export const handler = createMiddlewareLambdaFunctionURLHandler(baseHandler)
  .use(lambdaFunctionURLHandler({ methods: ['POST'], urlPattern: '/clients' }))
  .use(cognitoIdentityProvider())
  .use(dynamoDB());
