import assert from 'node:assert';

import config from './config.mjs';
import createRequest from './createRequest.mjs';
import { formatTime } from './date.mjs';
import { printLog, printMsg } from './log.mjs';

/**
 * @typedef {import('./types').Movie} Movie
 * @typedef {import('./types').ViewLog} ViewLog
 */

/**
 * @typedef {object} MubiMovie
 * @property {number} id
 * @property {string} web_url
 * @property {string} title
 * @property {number} year
 * @property {number} duration - in minutes
 */

/**
 * @typedef {object} MubiViewLogEntry
 * @property {string} watched_at
 * @property {MubiMovie} film
 */

const MUBI_API_BASE = 'https://api.mubi.com/v3/';
const MUBI_PER_PAGE = 24;

/**
 * @param {string} pathname
 * @param {RequestInit & { searchParams: URLSearchParams }} options
 * @return {Promise<Response>}
 */
const request = createRequest(MUBI_API_BASE, {
    createHeaders: async () => ({
        'Accept-Language': config.language,
        Authorization: `Bearer ${config['mubi-token']}`,
        Client: 'web',
        'Client-Country': config['mubi-country'],
    }),
});

/**
 * @param {MubiMovie}
 * @return {Movie}
 */
function convertMubiMovie (mubiMovie)
{
    return {
        title: mubiMovie.title,
        year: mubiMovie.year,
        services: [
            {
                service: 'mubi',
                id: mubiMovie.id,
                url: mubiMovie.web_url,
            },
        ],
    };
}

/**
 * @param {number} page
 * @return {Promise<ViewLog>}
 */
async function mubiFetchViewLogPage (page)
{
    ['mubi-token', 'mubi-country'].forEach((name) => {
        assert.ok(config[name], `Required argument --${name} missing.`);
    });

    printLog('Fetching view log from Mubi:', 'page', page);

    const response = await request('view_logs', {
        searchParams: new URLSearchParams({
            page,
            per_page: MUBI_PER_PAGE,
        }),
    });
    /** @type Array<MubiViewLogEntry> */
    const mubiViewLog = (await response.json()).view_logs;

    const viewLog = mubiViewLog.map(
        ({ watched_at: time, film: mubiMovie }) => ({
            time: new Date(time),
            movie: convertMubiMovie(mubiMovie),
        }),
    );

    return viewLog;
}

/**
 * @param {{ since: Date }} options
 * @return {Promise<ViewLog>}
 */
export async function mubiFetchViewLog ({ since })
{
    printMsg('Fetching view log from Mubi', 'since', formatTime(since));

    /** @type ViewLog */
    const viewLog = [];
    for (
        /** @type number */
        let page = 1;
        page;
        page += 1
    )
    {
        // eslint-disable-next-line no-await-in-loop
        const viewLogPage = await mubiFetchViewLogPage(page);
        const viewLogNew =
            viewLogPage.filter((entry) => entry.time >= since);
        viewLog.push(...viewLogNew);
        if (viewLogNew.length < MUBI_PER_PAGE)
        {
            break;
        }
    }

    printMsg('Fetched', viewLog.length, 'view log entries from Mubi');

    return viewLog;
}
