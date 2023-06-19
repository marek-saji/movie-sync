#!/usr/bin/env node

import assert, { AssertionError } from 'node:assert';

import parseDate from '@nrk/simple-date-parse';

import { EX_OK, EX_SYNC_FAILED, EX_USAGE } from './consts/exitCodes.mjs';

import { mubiFetchViewLog } from './lib/mubi.mjs';
import { traktSyncViewLog } from './lib/trakt.mjs';
import { configFileInit } from './lib/configFile.mjs';
import args, { argsInit, printHelp } from './lib/args.mjs';
import { printErr } from './lib/log.mjs';

/**
 * @typedef {import('./types').ViewLog} ViewLog
 */

await Promise.all([
    configFileInit(),
    argsInit(),
]);

if (args.help)
{
    printHelp();
    process.exit(EX_OK);
}

try
{
    const now = new Date();
    const since = parseDate(args.since, now);
    assert.ok(!Number.isNaN(since), `Invalid since date: ${args.since}`);
    assert.ok(since.toISOString() !== now.toISOString(), `Failed to parse since date: ${args.since}`);

    /** @type {ViewLog} */
    const viewLog = await mubiFetchViewLog({ since });

    if (viewLog.length)
    {
        const success = await traktSyncViewLog(viewLog);
        if (!success)
        {
            printErr('Failed to save view log on trakt.tv');
            process.exit(EX_SYNC_FAILED);
        }
    }
}
catch (error)
{
    if (error instanceof AssertionError && !error.generatedMessage)
    {
        printErr(error.message);
        process.exit(EX_USAGE);
    }
    else
    {
        throw error;
    }
}

process.exit(EX_OK);
