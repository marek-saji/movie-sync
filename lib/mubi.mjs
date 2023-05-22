import assert from 'node:assert';

import config from './config.mjs';
import createRequest from './createRequest.mjs';

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

export const MUBI_API_BASE = 'https://api.mubi.com/v3/';
const MUBI_PER_PAGE = 24;

/**
 * @param {string} pathname
 * @param {RequestInit & { searchParams: URLSearchParams }} options
 * @return {any}
 */
const request = createRequest(MUBI_API_BASE, {
    createHeaders: () => ({
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
 * @return {ViewLog}
 */
async function mubiFetchViewLogPage (page)
{
    ['mubi-token', 'mubi-country'].forEach((name) => {
        assert(config[name], `Required argument --${name} missing.`);
    });

    const response = await request('view_logs', {
        searchParams: new URLSearchParams({
            page,
            per_page: MUBI_PER_PAGE,
        }),
    });
    /** @type Array<MubiViewLogEntry> */
    const mubiViewLog = (await response.json()).view_logs;

    const viewLog = mubiViewLog.map(({ watched_at: time, film: mubiMovie }) => ({
        time: new Date(time),
        movie: convertMubiMovie(mubiMovie),
    }));

    return viewLog;
}

/**
 * @return {ViewLog}
 */
export async function mubiFetchViewLog ()
{
    // TODO Paginate
    return mubiFetchViewLogPage(1);
}
