import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { BaseNodejsFunction } from '../lambda.js';

export interface PreTokenGenerationFunctionProps {
  table: ITable;
}

export class PreTokenGenerationFunction extends BaseNodejsFunction {
  constructor(scope: Construct, props: PreTokenGenerationFunctionProps) {
    const { table } = props;
    super(scope, 'PreTokenGeneration', {
      dynamodb: {
        table,
      },
    });
  }
}
