import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

import { GitHubOidcStack, ServerlessMcpStack } from '../lib/index.js';
import { Config } from '../lib/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

expect.addSnapshotSerializer({
  test: (val: unknown) => typeof val === 'string',
  print: (val: unknown) =>
    `"${(val as string)
      .replace(
        /([A-Fa-f0-9]{64})\.(json|zip)|(SsrEdgeFunctionCurrentVersion[A-Fa-f0-9]{40})/,
        '[FILENAME REMOVED]'
      )
      .replace(
        /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
        '[VERSION REMOVED]'
      )}"`,
});

describe('ServerlessMcp Stack', () => {
  it('should match CDK snapshot', async () => {
    const config = await Config.parseConfig(join(__dirname, '../config'));
    const stack = new ServerlessMcpStack(new App(), config);
    const template = Template.fromStack(stack);

    expect(template.toJSON()).toMatchSnapshot();
  });
});

describe('GitHubOidc Stack', () => {
  it('should match CDK snapshot', async () => {
    const config = await Config.parseConfig(join(__dirname, '../config'));
    const stack = new GitHubOidcStack(new App(), config);
    const template = Template.fromStack(stack);

    expect(template.toJSON()).toMatchSnapshot();
  });
});
