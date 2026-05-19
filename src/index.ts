#!/usr/bin/env node

import { createAgent } from './agent/createAgent.js';
import { loadEnvFile } from './config/envFile.js';
import { loadLocalModelConfig } from './config/localModelConfig.js';
import { LocalModelClient } from './model/localModelClient.js';
import { createTerminalPermissionConfirmer, startTerminal } from './cli/terminal.js';

await loadEnvFile();

const config = loadLocalModelConfig(process.env);
const model = new LocalModelClient(config);
const agent = await createAgent({ model, workspaceRoot: process.cwd(), confirmPermission: createTerminalPermissionConfirmer() });

await startTerminal({ agent, config });
