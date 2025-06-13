import {
  createMiddlewareLambdaFunctionURLHandler,
  lambdaFunctionURLHandler,
  MiddlewareLambdaFunctionURLHandler,
} from '#middleware';
import { logger } from '#powertools';
import { createJsonResponse } from '#utils';

import packageInfo from '../../../package.json' with { type: 'json' };

export const baseHandler: MiddlewareLambdaFunctionURLHandler = async () => {
  const result = {
    name: packageInfo.name,
    version: packageInfo.version,
  };
  logger.debug('Serverless MCP', result);

  return createJsonResponse(200, result);
};

export const handler = createMiddlewareLambdaFunctionURLHandler(
  baseHandler
).use(lambdaFunctionURLHandler({ urlPattern: '/*' }));
