#!/usr/bin/env node

// TODO Be more verbose about what’s going on

import { mubiFetchViewLog } from './lib/mubi.mjs';
import { traktAuth, traktSyncViewLog } from './lib/trakt.mjs';
import args, { printHelp } from './lib/args.mjs';

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

/**
 * Normal exit
 */
const EX_OK = 0;
/**
 * Synchronisation failed
 */
const EX_SYNC_FAILED = 3;

if (args.help)
{
    printHelp();
    process.exit(EX_OK);
}

// TODO --since
const viewLog = await mubiFetchViewLog();

// TODO Store token
// TODO Refresh token
const { access_token: traktToken } = await traktAuth();
const success = await traktSyncViewLog(traktToken, viewLog);
if (!success)
{
    process.exit(EX_SYNC_FAILED);
}
