import { Duration, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { ManagedLoginVersion } from 'aws-cdk-lib/aws-cognito';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import {
  AaaaRecord,
  ARecord,
  HostedZone,
  RecordTarget,
} from 'aws-cdk-lib/aws-route53';
import {
  CloudFrontTarget,
  UserPoolDomainTarget,
} from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

import {
  GithubActionsIdentityProvider,
  GithubActionsRole,
} from 'aws-cdk-github-oidc';

import { BaseDnsValidatedCertificate } from './certificate.js';
import { Config } from './config.js';
import { CloudFrontDistribution } from './distribution.js';
import { CognitoUserPool } from './userPool.js';
import { DynamodbTable } from './table.js';

export class ServerlessMcpStack extends Stack {
  constructor(scope: Construct, config: Config, stackProps?: StackProps) {
    const { projectId } = config;
    Tags.of(scope).add('Project', projectId);

    super(scope, projectId, stackProps);

    const { domainName, hostedZoneId } = config.values;

    // Hosted zone for the domain
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId,
      zoneName: domainName,
    });

    // Create a DNS validated certificate for the domain
    const certificate = new BaseDnsValidatedCertificate(this, 'Certificate', {
      domainName,
      hostedZone,
    });

    // Dynamodb table for mcp data
    const table = new DynamodbTable(this, 'Table');

    // Cognito user pool for mcp oauth authentication with custom domain
    const userPool = new CognitoUserPool(this, 'UserPool', {
      table,
    });

    // CloudFront distribution with mcp endpoints configuration
    const distribution = new CloudFrontDistribution(this, 'Distribution', {
      certificate,
      domainName,
      hostedZone,
      table,
      userPool,
    });

    const distributionARecord = new ARecord(this, 'DistributionARecord', {
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      zone: hostedZone,
    });

    new AaaaRecord(this, 'DistributionAaaaRecord', {
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      zone: hostedZone,
    });

    // Use the new managed login page
    const userPoolDomain = userPool.addDomain('CognitoDomainWithManagedLogin', {
      customDomain: {
        domainName: `auth.${domainName}`,
        certificate,
      },
      managedLoginVersion: ManagedLoginVersion.CLASSIC_HOSTED_UI,
    });

    // User poll domain needs the A record of the cloudfront distribution
    userPoolDomain.node.addDependency(distributionARecord);

    new ARecord(this, 'UserPoolARecord', {
      recordName: 'auth',
      target: RecordTarget.fromAlias(new UserPoolDomainTarget(userPoolDomain)),
      zone: hostedZone,
    });

    new AaaaRecord(this, 'UserPoolAaaaRecord', {
      recordName: 'auth',
      target: RecordTarget.fromAlias(new UserPoolDomainTarget(userPoolDomain)),
      zone: hostedZone,
    });
  }
}

export class GitHubOidcStack extends Stack {
  constructor(scope: Construct, config: Config, stackProps?: StackProps) {
    const { projectId } = config;

    Tags.of(scope).add('Project', projectId);

    super(scope, `${projectId}-github-oidc`, stackProps);

    const { github } = config.values;
    const { owner, repo } = github ?? {};

    if (!owner || !repo) {
      throw new Error('GitHub owner and repo must be provided');
    }

    const provider = new GithubActionsIdentityProvider(this, 'GithubProvider');
    const deployRole = new GithubActionsRole(this, 'DeployRole', {
      provider,
      owner,
      repo,
      roleName: `github-actions-role-${projectId}`,
      description: `GitHub Actions CDK deploy role for ${projectId}`,
      maxSessionDuration: Duration.hours(1),
    });
    ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess');

    deployRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
    );
  }
}
