import { Stack } from 'aws-cdk-lib';
import { IUserPool } from 'aws-cdk-lib/aws-cognito';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { BaseNodejsFunction } from '../lambda.js';

export interface ClientsFunctionProps {
  table: ITable;
  userPool: IUserPool;
}

export class ClientsFunction extends BaseNodejsFunction {
  constructor(scope: Construct, props: ClientsFunctionProps) {
    const { table, userPool } = props;
    super(scope, 'Clients', {
      dynamodb: {
        table,
        grantWriteData: true,
      },
      nodejsFunctionProps: {
        environment: {
          USER_POOL_ID: userPool.userPoolId,
        },
      },
    });

    const { account, region } = Stack.of(this);
    this.assumedRole.addToPolicy(
      new PolicyStatement({
        actions: [
          'cognito-idp:CreateUserPoolClient',
          'cognito-idp:DescribeUserPoolClient',
        ],
        resources: [
          `arn:aws:cognito-idp:${region}:${account}:userpool/${userPool.userPoolId}`,
        ],
        effect: Effect.ALLOW,
      })
    );
  }
}
