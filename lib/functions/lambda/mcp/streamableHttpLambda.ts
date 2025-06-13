import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  EventStore,
  StreamableHTTPServerTransportOptions,
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  isInitializeRequest,
  isJSONRPCError,
  isJSONRPCRequest,
  isJSONRPCResponse,
  JSONRPCMessage,
  JSONRPCMessageSchema,
  RequestId,
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  LATEST_PROTOCOL_VERSION,
  InitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';

import { LambdaFunctionURLEvent } from 'aws-lambda';
import { randomUUID } from 'node:crypto';

import { Logger } from '@aws-lambda-powertools/logger';

export const SUPPORTED_PROTOCOL_VERSIONS = [
  LATEST_PROTOCOL_VERSION,
  '2025-03-26',
];

export class StreamableLambdaHTTPServerTransport implements Transport {
  // when sessionId is not set (undefined), it means the transport is in stateless mode
  private sessionIdGenerator: (() => string) | undefined;
  private _started: boolean = false;
  private _streamMapping: Map<string, awslambda.HttpResponseStream> = new Map();
  private _requestResponseMap: Map<RequestId, JSONRPCMessage> = new Map();
  private _requestToStreamMapping: Map<RequestId, string> = new Map();
  private _initialized: boolean = false;
  private _enableJsonResponse: boolean = false;
  private _standaloneSseStreamId: string = '_GET_stream';
  private _eventStore?: EventStore;
  private _onsessioninitialized?: (sessionId: string) => void;

  private logger: Logger;

  sessionId?: string;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (
    message: JSONRPCMessage,
    extra?: { authInfo?: AuthInfo }
  ) => void;

  constructor(
    options: StreamableHTTPServerTransportOptions & { logger: Logger }
  ) {
    this.logger = options.logger;
    this.logger.debug('constructor', { options });
    this.sessionIdGenerator = options.sessionIdGenerator;
    this._enableJsonResponse = options.enableJsonResponse ?? false;
    this._eventStore = options.eventStore;
    this._onsessioninitialized = options.onsessioninitialized;
  }

  /**
   * Starts the transport. This is required by the Transport interface but is a no-op
   * for the Streamable HTTP transport as connections are managed per-request.
   */
  async start(): Promise<void> {
    if (this._started) {
      throw new Error('Transport already started');
    }
    this._started = true;
  }

  async handleRequest(
    event: LambdaFunctionURLEvent,
    res: awslambda.HttpResponseStream,
    parsedBody?: unknown
  ): Promise<void> {
    const {
      http: { method },
    } = event.requestContext;
    this.logger.debug('handle event', { request: event.requestContext });
    switch (method) {
      case 'POST':
        await this.handlePostRequest(event, res, parsedBody);
        break;
      case 'GET':
        await this.handleGetRequest(event, res);
        break;
      case 'DELETE':
        await this.handleDeleteRequest(event, res);
        break;
      default:
        await this.handleUnsupportedRequest(res);
    }
  }

  setResponseMetadata(
    res: awslambda.HttpResponseStream,
    statusCode: number,
    headers?: Record<string, string>
  ) {
    this.logger.debug('setResponseMetadata', { statusCode, headers });
    return awslambda.HttpResponseStream.from(res, {
      statusCode,
      headers,
    });
  }

  sendError = (
    res: awslambda.HttpResponseStream,
    data: {
      statusCode: number;
      headers?: Record<string, string>;
      code: number;
      message: string;
      data?: string;
    }
  ) => {
    this.logger.error('mcp error', { data });
    const { statusCode, headers, code, message } = data;
    res = this.setResponseMetadata(res, statusCode, headers);
    res.write(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code,
          message,
          data,
        },
        id: null,
      })
    );
    res.end();
  };

  /**
   * Handles GET requests for SSE stream
   */
  private async handleGetRequest(
    event: LambdaFunctionURLEvent,
    res: awslambda.HttpResponseStream
  ): Promise<void> {
    this.logger.debug('handle GET request', { event });
    // The client MUST include an Accept header, listing text/event-stream as a supported content type.
    const acceptHeader = event.headers.accept;
    // The client MUST include an Accept header, listing both application/json and text/event-stream as supported content types.
    if (!acceptHeader?.includes('text/event-stream')) {
      this.sendError(res, {
        statusCode: 406,
        code: -32000,
        message: 'Not Acceptable: Client must accept text/event-stream',
      });
      return;
    }

    // If an Mcp-Session-Id is returned by the server during initialization,
    // clients using the Streamable HTTP transport MUST include it
    // in the Mcp-Session-Id header on all of their subsequent HTTP requests.
    if (!this.validateSession(event, res)) {
      return;
    }

    if (!this.validateProtocolVersion(event, res)) {
      return;
    }

    // Handle resumability: check for Last-Event-ID header
    if (this._eventStore) {
      const lastEventId = event.headers['last-event-id'] as string | undefined;
      if (lastEventId) {
        await this.replayEvents(lastEventId, res);
        return;
      }
    }

    // The server MUST either return Content-Type: text/event-stream in response to this HTTP GET,
    // or else return HTTP 405 Method Not Allowed
    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    };

    // After initialization, always include the session ID if we have one
    if (this.sessionId !== undefined) {
      headers['mcp-session-id'] = this.sessionId;
    }

    // Check if there's already an active standalone SSE stream for this session
    if (this._streamMapping.get(this._standaloneSseStreamId) !== undefined) {
      // Only one GET SSE stream is allowed per session
      this.sendError(res, {
        statusCode: 409,
        headers,
        code: -32000,
        message: 'Conflict: Only one SSE stream is allowed per session',
      });
      return;
    }

    // We need to send headers immediately as messages will arrive much later,
    // otherwise the client will just wait for the first message
    res = this.setResponseMetadata(res, 200, headers);

    // Assign the response to the standalone SSE stream
    this._streamMapping.set(this._standaloneSseStreamId, res);
    // Set up close handler for client disconnects
    res.on('close', () => {
      this._streamMapping.delete(this._standaloneSseStreamId);
    });
  }

  /**
   * Replays events that would have been sent after the specified event ID
   * Only used when resumability is enabled
   */
  private async replayEvents(
    lastEventId: string,
    res: awslambda.HttpResponseStream
  ): Promise<void> {
    if (!this._eventStore) {
      return;
    }
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      };

      if (this.sessionId !== undefined) {
        headers['mcp-session-id'] = this.sessionId;
      }

      res = this.setResponseMetadata(res, 200, headers);

      const streamId = await this._eventStore?.replayEventsAfter(lastEventId, {
        send: async (eventId: string, message: JSONRPCMessage) => {
          if (!this.writeSSEEvent(res, message, eventId)) {
            this.onerror?.(new Error('Failed replay events'));
            res.end();
          }
        },
      });
      this._streamMapping.set(streamId, res);
    } catch (error) {
      this.onerror?.(error as Error);
    }
  }

  /**
   * Writes an event to the SSE stream with proper formatting
   */
  private writeSSEEvent(
    res: awslambda.HttpResponseStream,
    message: JSONRPCMessage,
    eventId?: string
  ): boolean {
    let eventData = `event: message\n`;
    // Include event ID if provided - this is important for resumability
    if (eventId) {
      eventData += `id: ${eventId}\n`;
    }
    eventData += `data: ${JSON.stringify(message)}\n\n`;

    this.logger.debug('writeSSEEvent', { eventData });
    return res.write(eventData);
  }

  /**
   * Handles unsupported requests (PUT, PATCH, etc.)
   */
  private async handleUnsupportedRequest(
    res: awslambda.HttpResponseStream
  ): Promise<void> {
    this.sendError(res, {
      statusCode: 405,
      headers: {
        Allow: 'GET, POST, DELETE',
      },
      code: -32000,
      message: 'Method not allowed.',
    });
  }

  /**
   * Handles POST requests containing JSON-RPC messages
   */
  private async handlePostRequest(
    event: LambdaFunctionURLEvent,
    res: awslambda.HttpResponseStream,
    parsedBody?: unknown
  ): Promise<void> {
    try {
      this.logger.debug('handle POST request', { event, parsedBody });
      const { headers, requestContext } = event;

      // Validate the Accept header
      const acceptHeader = headers.accept;
      // The client MUST include an Accept header, listing both application/json and text/event-stream as supported content types.
      if (
        !acceptHeader?.includes('application/json') ||
        !acceptHeader.includes('text/event-stream')
      ) {
        this.sendError(res, {
          statusCode: 406,
          code: -32000,
          message:
            'Not Acceptable: Client must accept both application/json and text/event-stream',
        });
        return;
      }

      // Validate the Content-Type header
      const contentTypeHeader = headers['content-type'];
      if (
        !contentTypeHeader ||
        !contentTypeHeader.includes('application/json')
      ) {
        this.sendError(res, {
          statusCode: 415,
          code: -32000,
          message:
            'Unsupported Media Type: Content-Type must be application/json',
        });
        return;
      }

      const authInfo: AuthInfo | undefined = Object.entries(
        requestContext
      ).find(([key, _value]) => key === 'auth')?.[1] as AuthInfo | undefined;

      let rawMessage;
      if (parsedBody !== undefined) {
        rawMessage = parsedBody;
      } else {
        rawMessage = JSON.parse(event.body ?? '{}');
      }

      let messages: JSONRPCMessage[];

      // handle batch and single messages
      if (Array.isArray(rawMessage)) {
        messages = rawMessage.map((msg) => JSONRPCMessageSchema.parse(msg));
      } else {
        messages = [JSONRPCMessageSchema.parse(rawMessage)];
      }

      // Check if this is an initialization request
      // https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle/
      if (messages.some(isInitializeRequest)) {
        // If it's a server with session management and the session ID is already set we should reject the request
        // to avoid re-initialization.
        if (this._initialized && this.sessionId !== undefined) {
          this.sendError(res, {
            statusCode: 400,
            code: -32600,
            message: 'Invalid Request: Server already initialized',
          });
          return;
        }
        if (messages.length > 1) {
          this.sendError(res, {
            statusCode: 400,
            code: -32600,
            message:
              'Invalid Request: Only one initialization request is allowed',
          });
          return;
        }

        const protocolVersion = (messages[0] as unknown as InitializeRequest)
          .params.protocolVersion;
        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
          this.sendError(res, {
            statusCode: 400,
            code: -32000,
            message: `Bad Request: Unsupported protocol version (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')})`,
          });
        }

        this.sessionId = this.sessionIdGenerator?.();
        this._initialized = true;

        // If we have a session ID and an onsessioninitialized handler, call it immediately
        // This is needed in cases where the server needs to keep track of multiple sessions
        if (this.sessionId && this._onsessioninitialized) {
          this._onsessioninitialized(this.sessionId);
        }
      } else {
        // If an Mcp-Session-Id is returned by the server during initialization,
        // clients using the Streamable HTTP transport MUST include it
        // in the Mcp-Session-Id header on all of their subsequent HTTP requests.
        if (!this.validateSession(event, res)) {
          return;
        }
        // Mcp-Protocol-Version header is required for all requests after initialization.
        if (!this.validateProtocolVersion(event, res)) {
          return;
        }
      }

      // check if it contains requests
      const hasRequests = messages.some(isJSONRPCRequest);

      if (!hasRequests) {
        // if it only contains notifications or responses, return 202
        res = this.setResponseMetadata(res, 202);
        res.write(
          JSON.stringify({
            jsonrpc: '2.0',
            result: 'Hello',
            id: null,
          })
        );
        res.end();

        // handle each message
        for (const message of messages) {
          this.onmessage?.(message, { authInfo });
        }
        return;
      }

      // The default behavior is to use SSE streaming
      // but in some cases server will return JSON responses
      const streamId = randomUUID();
      if (!this._enableJsonResponse) {
        const headers: Record<string, string> = {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        };

        // After initialization, always include the session ID if we have one
        if (this.sessionId !== undefined) {
          headers['mcp-session-id'] = this.sessionId;
        }

        res = this.setResponseMetadata(res, 200, headers);
      }
      // Store the response for this request to send messages back through this connection
      // We need to track by request ID to maintain the connection
      for (const message of messages) {
        if (isJSONRPCRequest(message)) {
          this._streamMapping.set(streamId, res);
          this._requestToStreamMapping.set(message.id, streamId);
        }
      }

      // Set up close handler for client disconnects
      res.on('close', () => {
        this._streamMapping.delete(streamId);
      });

      // handle each message
      for (const message of messages) {
        this.onmessage?.(message, { authInfo });
      }
      // The server SHOULD NOT close the SSE stream before sending all JSON-RPC responses
      // This will be handled by the send() method when responses are ready
    } catch (error) {
      this.logger.error('Error handling POST request', error as Error);
      this.sendError(res, {
        statusCode: 400,
        code: -32700,
        message: 'Parse error',
        data: String(error),
      });
      this.onerror?.(error as Error);
    }
  }

  /**
   * Handles DELETE requests to terminate sessions
   */
  private async handleDeleteRequest(
    event: LambdaFunctionURLEvent,
    res: awslambda.HttpResponseStream
  ): Promise<void> {
    this.logger.debug('handle DELETE request', { event });
    if (!this.validateSession(event, res)) {
      return;
    }
    if (!this.validateProtocolVersion(event, res)) {
      return;
    }
    await this.close();
    res = this.setResponseMetadata(res, 200);
    res.write('\n');
    res.end();
  }

  /**
   * Validates session ID for non-initialization requests
   * Returns true if the session is valid, false otherwise
   */
  private validateSession(
    event: LambdaFunctionURLEvent,
    res: awslambda.HttpResponseStream
  ): boolean {
    if (this.sessionIdGenerator === undefined) {
      // If the sessionIdGenerator ID is not set, the session management is disabled
      // and we don't need to validate the session ID
      return true;
    }
    if (!this._initialized) {
      // If the server has not been initialized yet, reject all requests
      this.sendError(res, {
        statusCode: 400,
        code: -32000,
        message: 'Bad Request: Server not initialized',
      });
      return false;
    }

    const sessionId = event.headers['mcp-session-id'];

    if (!sessionId) {
      // Non-initialization requests without a session ID should return 400 Bad Request
      this.sendError(res, {
        statusCode: 400,
        code: -32000,
        message: 'Bad Request: Mcp-Session-Id header is required',
      });
      return false;
    } else if (Array.isArray(sessionId)) {
      this.sendError(res, {
        statusCode: 400,
        code: -32000,
        message: 'Bad Request: Mcp-Session-Id header must be a single value',
      });
      return false;
    } else if (sessionId !== this.sessionId) {
      // Reject requests with invalid session ID with 404 Not Found
      this.sendError(res, {
        statusCode: 404,
        code: -32001,
        message: 'Session not found',
      });
      return false;
    }

    return true;
  }

  private validateProtocolVersion(
    event: LambdaFunctionURLEvent,
    res: awslambda.HttpResponseStream
  ): boolean {
    let protocolVersion =
      event.headers['mcp-protocol-version'] ??
      DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
    if (Array.isArray(protocolVersion)) {
      protocolVersion = protocolVersion[protocolVersion.length - 1];
    }

    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion)) {
      this.sendError(res, {
        statusCode: 400,
        code: -32000,
        message: `Bad Request: Unsupported protocol version (supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')})`,
      });
      return false;
    }
    return true;
  }

  async close(): Promise<void> {
    // Close all SSE connections
    this._streamMapping.forEach((response) => {
      response.end();
    });
    this._streamMapping.clear();

    // Clear any pending responses
    this._requestResponseMap.clear();
    this.onclose?.();
  }

  async send(
    message: JSONRPCMessage,
    options?: { relatedRequestId?: RequestId }
  ): Promise<void> {
    this.logger.debug('send message', { data: { message, options } });
    let requestId = options?.relatedRequestId;
    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      // If the message is a response, use the request ID from the message
      requestId = message.id;
    }

    // Check if this message should be sent on the standalone SSE stream (no request ID)
    // Ignore notifications from tools (which have relatedRequestId set)
    // Those will be sent via dedicated response SSE streams
    if (requestId === undefined) {
      // For standalone SSE streams, we can only send requests and notifications
      if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
        throw new Error(
          'Cannot send a response on a standalone SSE stream unless resuming a previous client request'
        );
      }
      const standaloneSse = this._streamMapping.get(
        this._standaloneSseStreamId
      );
      if (standaloneSse === undefined) {
        // The spec says the server MAY send messages on the stream, so it's ok to discard if no stream
        return;
      }

      // Generate and store event ID if event store is provided
      let eventId: string | undefined;
      if (this._eventStore) {
        // Stores the event and gets the generated event ID
        eventId = await this._eventStore.storeEvent(
          this._standaloneSseStreamId,
          message
        );
      }

      // Send the message to the standalone SSE stream
      this.writeSSEEvent(standaloneSse, message, eventId);
      return;
    }

    // Get the response for this request
    const streamId = this._requestToStreamMapping.get(requestId);
    let response = this._streamMapping.get(streamId!);
    if (!streamId) {
      throw new Error(
        `No connection established for request ID: ${String(requestId)}`
      );
    }

    if (!this._enableJsonResponse) {
      // For SSE responses, generate event ID if event store is provided
      let eventId: string | undefined;

      if (this._eventStore) {
        eventId = await this._eventStore.storeEvent(streamId, message);
      }
      if (response) {
        // Write the event to the response stream
        this.writeSSEEvent(response, message, eventId);
      }
    }

    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      this._requestResponseMap.set(requestId, message);
      const relatedIds = Array.from(this._requestToStreamMapping.entries())
        .filter(
          ([_, streamId]) => this._streamMapping.get(streamId) === response
        )
        .map(([id]) => id);

      // Check if we have responses for all requests using this connection
      const allResponsesReady = relatedIds.every((id) =>
        this._requestResponseMap.has(id)
      );

      if (allResponsesReady) {
        if (!response) {
          throw new Error(
            `No connection established for request ID: ${String(requestId)}`
          );
        }
        if (this._enableJsonResponse) {
          // All responses ready, send as JSON
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (this.sessionId !== undefined) {
            headers['mcp-session-id'] = this.sessionId;
          }

          const responses = relatedIds.map(
            (id) => this._requestResponseMap.get(id)!
          );
          response = this.setResponseMetadata(response, 200, headers);
          if (responses.length === 1) {
            response.write(JSON.stringify(responses[0]));
          } else {
            response.write(JSON.stringify(responses));
          }
          response.end();
        } else {
          // End the SSE stream
          response.end();
        }
        // Clean up
        for (const id of relatedIds) {
          this._requestResponseMap.delete(id);
          this._requestToStreamMapping.delete(id);
        }
      }
    }
  }
}
