#!/usr/bin/env node

import { AssertionError } from 'node:assert';

import { EX_OK, EX_SYNC_FAILED, EX_USAGE } from './consts/exitCodes.mjs';

import { mubiFetchViewLog } from './lib/mubi.mjs';
import { traktSyncViewLog } from './lib/trakt.mjs';
import { configFileInit } from './lib/configFile.mjs';
import args, { argsInit, printHelp } from './lib/args.mjs';
import { printErr, printMsg } from './lib/log.mjs';

// FIXME Make these types available in lib/{trakt,mubi}

/**
 * @typedef {object} MovieInService
 * @property {'mubi'|'trakt.tv'|'tmdb'|'imdb'} service
 * @property {string} id
 * @property {string} url
 */

/**
 * @typedef {object} Movie
 * @property {string} title
 * @property {number} year
 * @property {Array<MovieInService>} services
 */

/**
 * @typedef {object} ViewLogEntry
 * @property {Date} time
 * @property {Movie} movie
 */

/** @typedef {Array<ViewLogEntry>} ViewLog */

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
    // TODO --since
    /** @type {ViewLog} */
    const viewLog = await mubiFetchViewLog();

    const success = await traktSyncViewLog(viewLog);
    if (!success)
    {
        printErr('Failed to save view log on trakt.tv');
        process.exit(EX_SYNC_FAILED);
    }
}
catch (error)
{
    if (error instanceof AssertionError && !error.generatedMessage)
    {
        printErr(error.message);
        process.exit(EX_USAGE);
    }
}

process.exit(EX_OK);
