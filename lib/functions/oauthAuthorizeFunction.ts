import { Construct } from 'constructs';

import { BaseNodejsFunction } from '../lambda.js';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';

export interface OauthAuthorizeFunctionProps {
  userPool: IUserPool;
}

export class OauthAuthorizeFunction extends BaseNodejsFunction {
  constructor(scope: Construct, opts: OauthAuthorizeFunctionProps) {
    const { userPool } = opts;
    super(scope, 'OauthAuthorize', {
      nodejsFunctionProps: {
        environment: {
          USER_POOL_ID: userPool.userPoolId,
        },
      },
    });
  }
}
