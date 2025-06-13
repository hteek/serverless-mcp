import { Construct } from 'constructs';

import { BaseNodejsFunction } from '../lambda.js';

export class DefaultFunction extends BaseNodejsFunction {
  constructor(scope: Construct) {
    super(scope, 'Default');
  }
}
