import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import middy from '@middy/core';
import { getInternal } from '@middy/util';

import { Context } from 'aws-lambda';

import { getProcessEnv } from './util.js';

const client = new STSClient({});

/**
 * Retrieves the assumed role ARN from the environment variables.
 * @returns {string} The assumed role ARN.
 * @throws {Error} Throws an error if the assumed role ARN is not set in the environment variables.
 */
export const getAssumedRoleArn = (): string =>
  getProcessEnv('ASSUMED_ROLE_ARN', 'no assumed role arn given');

/**
 * Retrieves the credentials for the specified tenant by assuming a role.
 * @param client - The STS client used to assume the role.
 * @param context - The Lambda context object.
 * @param tenantId - The ID of the tenant for which to retrieve credentials.
 */
export const getCredentials = async (
  client: STSClient,
  context: Context,
  tenantId: string
) => {
  const assumedRoleArn = getAssumedRoleArn();
  const { Credentials } = await client.send(
    new AssumeRoleCommand({
      RoleArn: assumedRoleArn,
      RoleSessionName: context.awsRequestId,
      DurationSeconds: 900,
      Tags: [{ Key: 'TenantID', Value: tenantId }],
    })
  );
  return {
    credentials: {
      accessKeyId: Credentials?.AccessKeyId!,
      secretAccessKey: Credentials?.SecretAccessKey!,
      sessionToken: Credentials?.SessionToken,
    },
  };
};

/**
 * Middleware for assuming a role using AWS STS.
 * This middleware retrieves the tenant ID from the request context and uses it to assume a role.
 * The assumed role credentials are then added to the internal state of the request.
 * @returns {middy.MiddlewareObj} A Middy middleware object with a 'before' hook
 */
export const sts = (): middy.MiddlewareObj => ({
  before: async (request) => {
    const { context, internal } = request;
    const { tenantId } = (await getInternal(
      ['tenantId'],
      request
    )) as unknown as {
      tenantId: string;
    };

    const { credentials } = await getCredentials(client, context, tenantId);

    Object.assign(internal, { credentials });
  },
});
