import { Duration } from 'aws-cdk-lib';
import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import {
  ArnPrincipal,
  Effect,
  PolicyStatement,
  Role,
  SessionTagsPrincipal,
} from 'aws-cdk-lib/aws-iam';
import {
  Architecture,
  Function as Lambda,
  LambdaInsightsVersion,
  Runtime,
  Tracing,
} from 'aws-cdk-lib/aws-lambda';
import {
  NodejsFunction,
  NodejsFunctionProps,
  OutputFormat,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';

export interface BaseNodejsFunctionDynamodbProps {
  readonly table: ITable;
  readonly grantWriteData?: boolean;
}

export interface BaseNodejsFunctionProps {
  readonly dynamodb?: BaseNodejsFunctionDynamodbProps;
  readonly nodejsFunctionProps?: NodejsFunctionProps;
}

const decapitalize = (str?: string) =>
  str ? str.charAt(0).toLowerCase() + str.slice(1) : '';

const addDynamoDb = (
  fn: Lambda,
  role: Role,
  props?: BaseNodejsFunctionDynamodbProps
) => {
  const { table, grantWriteData } = props || {};

  if (!table) {
    return;
  }

  fn.addEnvironment('TABLE', table.tableName);

  if (grantWriteData) {
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'dynamodb:BatchWriteItem',
          'dynamodb:DeleteItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
        ],
        resources: [table.tableArn],
        conditions: {
          'ForAllValues:StringLike': {
            'dynamodb:LeadingKeys': [
              '${aws:PrincipalTag/TenantID}#*',
              'public#*',
            ],
          },
        },
      })
    );
  }
  role.addToPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'dynamodb:BatchGetItem',
        'dynamodb:ConditionCheckItem',
        'dynamodb:DescribeTable',
        'dynamodb:GetItem',
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:Query',
      ],
      resources: [table.tableArn, `${table.tableArn}/index/*`],
      conditions: {
        'ForAllValues:StringLike': {
          'dynamodb:LeadingKeys': [
            '${aws:PrincipalTag/TenantID}#*',
            'public#*',
          ],
        },
      },
    })
  );
};

export class BaseNodejsFunction extends NodejsFunction {
  readonly assumedRole: Role;

  constructor(scope: Construct, id: string, props?: BaseNodejsFunctionProps) {
    const { dynamodb, nodejsFunctionProps } = props ?? {};

    super(scope, `${id}Function`, {
      // defaults
      architecture: Architecture.ARM_64,
      insightsVersion: LambdaInsightsVersion.VERSION_1_0_275_0,
      logRetention: RetentionDays.TWO_WEEKS,
      memorySize: 3008, // full capacity of a single cpu core for best single thread performance
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.minutes(2),
      tracing: Tracing.ACTIVE,
      // overrides
      ...nodejsFunctionProps,
      entry: resolve(findEntry(id, nodejsFunctionProps?.entry)),
      bundling: {
        // defaults
        banner: `import module from 'module'; if (typeof globalThis.require === "undefined") { globalThis.require = module.createRequire(import.meta.url); }`,
        format: OutputFormat.ESM,
        sourceMap: true,
        // custom environment
        ...nodejsFunctionProps?.bundling,
        externalModules: [],
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        POWERTOOLS_LOG_LEVEL: 'DEBUG',
        POWERTOOLS_LOGGER_LOG_EVENT: 'true',
        POWERTOOLS_LOGGER_SAMPLE_RATE: '0',
        POWERTOOLS_TRACE_ENABLED: 'true',
        POWERTOOLS_TRACER_CAPTURE_RESPONSE: 'true',
        POWERTOOLS_TRACER_CAPTURE_ERROR: 'true',
        POWERTOOLS_TRACER_CAPTURE_HTTPS_REQUESTS: 'true',
        ...nodejsFunctionProps?.environment,
      },
    });

    // refers the Lambda function as an IAM Principal using its' ARN
    const arnPrincipal = new ArnPrincipal(this.role?.roleArn!).withConditions({
      StringLike: { [`aws:RequestTag/TenantID`]: '*' },
    });

    // sets the allowed key for tagging sessions
    const sessionTagsPrincipal = new SessionTagsPrincipal(arnPrincipal);

    // granting the Lambda function the permission to assume this IAM Role
    this.assumedRole = new Role(scope, `${id}FunctionRole`, {
      assumedBy: sessionTagsPrincipal,
    });

    this.addEnvironment('ASSUMED_ROLE_ARN', this.assumedRole.roleArn);

    addDynamoDb(this, this.assumedRole, dynamodb);
  }
}

const findEntry = (id: string, customEntry = 'lambda'): string => {
  const definingDirname = dirname(findDefiningFile()).replace(/^file:\/\//, '');
  const handler = `${decapitalize(id)}Handler`;

  const tsHandlerFile = join(definingDirname, customEntry, `${handler}.ts`);
  if (existsSync(tsHandlerFile)) {
    return tsHandlerFile;
  }

  const jsHandlerFile = join(definingDirname, customEntry, `${handler}.js`);
  if (existsSync(jsHandlerFile)) {
    return jsHandlerFile;
  }

  const mjsHandlerFile = join(definingDirname, customEntry, `${handler}.mjs`);
  if (existsSync(mjsHandlerFile)) {
    return mjsHandlerFile;
  }

  throw new Error(
    `Cannot find handler file ${tsHandlerFile}, ${jsHandlerFile} or ${mjsHandlerFile}`
  );
};

const findDefiningFile = (): string => {
  let definingIndex;
  const sites = callsites();
  for (const [index, site] of sites.entries()) {
    if (site.getFunctionName() === 'BaseNodejsFunction') {
      // The next site is the site where the BaseNodejsFunction was created
      definingIndex = index + 1;
      break;
    }
  }

  if (!definingIndex || !sites[definingIndex]) {
    throw new Error('Cannot find defining file.');
  }

  return sites[definingIndex]?.getFileName() ?? '';
};

interface CallSite {
  getThis(): unknown;

  getTypeName(): string;

  getFunctionName(): string;

  getMethodName(): string;

  getFileName(): string;

  getLineNumber(): number;

  getColumnNumber(): number;

  getFunction(): unknown;

  getEvalOrigin(): string;

  isNative(): boolean;

  isToplevel(): boolean;

  isEval(): boolean;

  isConstructor(): boolean;
}

const callsites = (): CallSite[] => {
  const _prepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stackTraces) => stackTraces;
  const stack = new Error().stack?.slice(1);
  Error.prepareStackTrace = _prepareStackTrace;
  return stack as unknown as CallSite[];
};
