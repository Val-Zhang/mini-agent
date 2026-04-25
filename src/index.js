#!/usr/bin/env node

import { createAgent } from './agent/createAgent.js';
import { loadLocalModelConfig } from './config/localModelConfig.js';
import { LocalModelClient } from './model/localModelClient.js';
import { startTerminal } from './cli/terminal.js';

const config = loadLocalModelConfig(process.env);
const model = new LocalModelClient(config);
const agent = createAgent({ model });

await startTerminal({ agent, config });
