import {
  AccountRecovery,
  FeaturePlan,
  LambdaVersion,
  UserPool,
  UserPoolOperation,
  VerificationEmailStyle,
} from 'aws-cdk-lib/aws-cognito';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { PreTokenGenerationFunction } from './functions/index.js';

export interface CognitoUserPoolProps {
  readonly table: ITable;
}

export class CognitoUserPool extends UserPool {
  constructor(scope: Construct, id: string, opts: CognitoUserPoolProps) {
    const { table } = opts;
    super(scope, id, {
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      featurePlan: FeaturePlan.ESSENTIALS,
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireSymbols: true,
        requireUppercase: true,
      },
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      signInCaseSensitive: false,
      signInPolicy: {
        allowedFirstAuthFactors: {
          password: true,
        },
      },
      userPoolName: 'serverless-mcp',
      userVerification: {
        emailStyle: VerificationEmailStyle.LINK,
        emailSubject: 'Serverless MCP - Invite to join!',
        emailBody:
          'You have been invited to join the Serverless MCP server! {##Verify Your Email##}',
      },
    });

    this.addTrigger(
      UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
      new PreTokenGenerationFunction(this, { table }),
      LambdaVersion.V3_0
    );
  }
}
