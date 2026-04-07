#!/usr/bin/env node

import { createCli } from './cli/index.js';

async function main() {
  const program = createCli();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main();
