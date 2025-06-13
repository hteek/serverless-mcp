import { Stack } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { BaseNodejsFunction } from '../lambda.js';

export interface McpFunctionProps {
  readonly domainName: string;
}

export class McpFunction extends BaseNodejsFunction {
  constructor(scope: Construct, props: McpFunctionProps) {
    const { domainName } = props;
    super(scope, 'Mcp', {
      nodejsFunctionProps: {
        environment: {
          DOMAIN_NAME: domainName,
        },
      },
    });

    const { account } = Stack.of(this);

    this.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'ce:GetCostAndUsage',
          'ce:GetCostForecast',
          'ce:GetDimensionValues',
        ],
        resources: [`arn:aws:ce:us-east-1:${account}:*`],
      })
    );

    this.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['pricing:*'],
        resources: ['*'],
      })
    );
  }
}
