#!/usr/bin/env node
import { App } from 'aws-cdk-lib';

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { Config } from '../lib/config.js';
import { GitHubOidcStack, ServerlessMcpStack } from '../lib/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new App();

Config.parseConfig(join(__dirname, '../config')).then((config) => {
  new ServerlessMcpStack(app, config);
  new GitHubOidcStack(app, config);
});
