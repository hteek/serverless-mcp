import {
  createMiddlewareLambdaFunctionURLHandler,
  dynamoDB,
  getLambdaFunctionURLContext,
  lambdaFunctionURLHandler,
  MiddlewareLambdaFunctionURLHandler,
} from '#middleware';
import { Client } from '#model';
import { createJsonResponse } from '#utils';

import { RegisterClientResponse } from './clientsHandler.js';

export type GetClientResponse = Omit<RegisterClientResponse, 'client_secret'>;

export const baseHandler: MiddlewareLambdaFunctionURLHandler = async (
  _event,
  context
) => {
  const {
    params: { id },
  } = getLambdaFunctionURLContext(context);

  const { client_metadata } = await Client.getById(context, id);

  const clientMetadata = JSON.parse(client_metadata);

  // Remove sensitive information
  delete clientMetadata.client_secret;

  // Return successful response
  return createJsonResponse<GetClientResponse>(200, clientMetadata);
};

export const handler = createMiddlewareLambdaFunctionURLHandler(baseHandler)
  .use(
    lambdaFunctionURLHandler({ methods: ['GET'], urlPattern: '/clients/:id' })
  )
  .use(dynamoDB());
