#!/usr/bin/env node
// The `storydeck` command (also `footprint-storydeck`, so `npx footprint-storydeck <command>` runs it uninstalled).
import {runCli} from './cli.js';

runCli(process.argv.slice(2)).then((code) => { process.exitCode = code; });
