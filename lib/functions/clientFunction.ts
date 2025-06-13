import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { BaseNodejsFunction } from '../lambda.js';

export interface ClientFunctionProps {
  table: ITable;
}

export class ClientFunction extends BaseNodejsFunction {
  constructor(scope: Construct, props: ClientFunctionProps) {
    const { table } = props;
    super(scope, 'Client', {
      dynamodb: {
        table,
      },
    });
  }
}
