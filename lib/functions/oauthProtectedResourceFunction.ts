import { Construct } from 'constructs';

import { BaseNodejsFunction } from '../lambda.js';

export interface OauthProtectedResourceFunctionProps {
  readonly domainName: string;
}

export class OauthProtectedResourceFunction extends BaseNodejsFunction {
  constructor(scope: Construct, props: OauthProtectedResourceFunctionProps) {
    const { domainName } = props;
    super(scope, 'OauthProtectedResource', {
      nodejsFunctionProps: {
        environment: {
          DOMAIN_NAME: domainName,
        },
      },
    });
  }
}
