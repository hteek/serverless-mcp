import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import middy from '@middy/core';
import { getInternal } from '@middy/util';
import { AwsCredentialIdentity } from '@smithy/types';

import { toKebabCase } from 'remeda';

import { getProcessEnv } from './util.js';

/**
 * Get the user pool id from the environment variable
 * @throws {Error} Throws an error if the user pool id is not set in the environment variables.
 */
export const getUserPoolId = () =>
  getProcessEnv('USER_POOL_ID', 'no user pool id given');

/**
 * Middleware for CognitoIdentityProvider
 * This middleware retrieves the user pool id from the environment variables and creates a CognitoIdentityProvider client.
 * It also adds the user pool id and a function to create a user pool client to the internal state of the request.
 * @returns {middy.MiddlewareObj} A Middy middleware object with a 'before' hook
 */
export const cognitoIdentityProvider = (): middy.MiddlewareObj => ({
  before: async (request) => {
    const userPoolId = getUserPoolId();
    const { credentials } = (await getInternal(
      ['credentials', 'tenantId'],
      request
    )) as unknown as {
      credentials: AwsCredentialIdentity;
      tenantId: string;
    };

    const client = new CognitoIdentityProviderClient({ credentials });

    const createClient = async (clientName: string, redirect_uris: string[]) =>
      await client.send(
        new CreateUserPoolClientCommand({
          AccessTokenValidity: 1,
          AllowedOAuthScopes: ['openid', 'email', 'profile'],
          AllowedOAuthFlows: ['code'],
          AllowedOAuthFlowsUserPoolClient: true,
          CallbackURLs: redirect_uris,
          ClientName: toKebabCase(clientName.replaceAll(/[\(\)]/g, '')),
          GenerateSecret: true,
          IdTokenValidity: 1,
          PreventUserExistenceErrors: 'ENABLED',
          RefreshTokenValidity: 30,
          SupportedIdentityProviders: ['COGNITO'],
          TokenValidityUnits: {
            AccessToken: 'hours',
            IdToken: 'hours',
            RefreshToken: 'days',
          },
          UserPoolId: userPoolId,
        })
      );

    Object.assign(request.internal, {
      createClient,
      userPoolId,
    });

    Object.assign(request.context, {
      cognitoIdentityProvider: {
        ...(await getInternal(['createClient'], request)),
        ...(await getInternal(['userPoolId'], request)),
      },
    });
  },
});
