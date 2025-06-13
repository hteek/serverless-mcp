import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  Distribution,
  OriginRequestPolicy,
  CachePolicy,
  ViewerProtocolPolicy,
  AddBehaviorOptions,
  ResponseHeadersPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { FunctionUrlOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import {
  FunctionUrlAuthType,
  HttpMethod,
  IFunction,
  InvokeMode,
} from 'aws-cdk-lib/aws-lambda';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

import {
  ClientFunction,
  ClientsFunction,
  DefaultFunction,
  McpFunction,
  OauthAuthorizationServerFunction,
  OauthAuthorizeFunction,
  OauthProtectedResourceFunction,
} from './functions/index.js';

export interface CloudFrontDistributionProps {
  readonly certificate: ICertificate;
  readonly domainName: string;
  readonly hostedZone: IHostedZone;
  readonly table: ITable;
  readonly userPool: IUserPool;
}

/**
 * A CloudFront distribution construct with sensible defaults
 */
export class CloudFrontDistribution extends Distribution {
  constructor(
    scope: Construct,
    id: string,
    props: CloudFrontDistributionProps
  ) {
    const {
      domainName,
      certificate,
      table,
      userPool,
    } = props;

    const functionUrlOrigin = (
      fn: IFunction,
      invokeMode = InvokeMode.BUFFERED
    ) =>
      new FunctionUrlOrigin(
        fn.addFunctionUrl({
          authType: FunctionUrlAuthType.NONE,
          invokeMode,
          cors: {
            allowedOrigins: ['*'],
            allowedMethods: [HttpMethod.ALL],
            allowedHeaders: ['*'],
            allowCredentials: true,
          },
        })
      );

    const behaviorOptions: AddBehaviorOptions = {
      allowedMethods: AllowedMethods.ALLOW_ALL,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      responseHeadersPolicy:
        ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT_AND_SECURITY_HEADERS,
    };

    super(scope, id, {
      certificate,
      defaultBehavior: {
        ...behaviorOptions,
        origin: functionUrlOrigin(new DefaultFunction(scope)),
      },
      domainNames: [domainName],
      enabled: true,
      comment: 'CloudFront distribution for a serverless mcp server',
    });

    const addFunctionUrlBehaviour = (
      pathPattern: string,
      fn: IFunction,
      invokeMode?: InvokeMode
    ) =>
      this.addBehavior(
        pathPattern,
        functionUrlOrigin(fn, invokeMode),
        behaviorOptions
      );

    addFunctionUrlBehaviour(
      '/.well-known/oauth-authorization-server',
      new OauthAuthorizationServerFunction(scope, { domainName, userPool })
    );
    addFunctionUrlBehaviour(
      '/.well-known/oauth-protected-resource',
      new OauthProtectedResourceFunction(scope, { domainName })
    );
    addFunctionUrlBehaviour(
      '/clients',
      new ClientsFunction(scope, { table, userPool })
    );
    addFunctionUrlBehaviour('/clients/*', new ClientFunction(scope, { table }));
    addFunctionUrlBehaviour(
      '/mcp*',
      new McpFunction(scope, { domainName }),
      InvokeMode.RESPONSE_STREAM
    );
    addFunctionUrlBehaviour(
      '/oauth/authorize',
      new OauthAuthorizeFunction(scope, { userPool })
    );
  }
}
