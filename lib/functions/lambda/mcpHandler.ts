import { LambdaFunctionURLEvent } from 'aws-lambda';

import { getServer, StreamableLambdaHTTPServerTransport } from '#mcp';
import { checkHttpMethodAndPath } from '#middleware';
import { logger } from '#powertools';
import { checkAuthorizationHeader } from '#utils';

export const handler = awslambda.streamifyResponse(
  async (
    event: LambdaFunctionURLEvent,
    responseStream: awslambda.HttpResponseStream
  ) => {
    logger.logEventIfEnabled(event);

    checkHttpMethodAndPath(event, '/mcp', ['POST']);
    checkAuthorizationHeader(event, responseStream);

    // Configure Streamable HTTP transport (sessionless)
    const transport = new StreamableLambdaHTTPServerTransport({
      logger,
      sessionIdGenerator: undefined, // Disable session management
    });
    await getServer().connect(transport);
    await transport.handleRequest(event, responseStream);
  }
);
