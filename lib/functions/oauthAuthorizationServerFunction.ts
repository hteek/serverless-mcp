import { Construct } from 'constructs';

import { BaseNodejsFunction } from '../lambda.js';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';

export interface OauthAuthorizationServerFunctionProps {
  readonly domainName: string;
  readonly userPool: IUserPool;
}

export class OauthAuthorizationServerFunction extends BaseNodejsFunction {
  constructor(scope: Construct, opts: OauthAuthorizationServerFunctionProps) {
    const { domainName, userPool } = opts;
    super(scope, 'OauthAuthorizationServer', {
      nodejsFunctionProps: {
        environment: {
          DOMAIN_NAME: domainName,
          USER_POOL_ID: userPool.userPoolId,
        },
      },
    });
  }
}
