import assert from 'node:assert';

import config from './config.mjs';
import { appendConfig } from './configFile.mjs';
import { VIEW_LOG_CLOSE_ENOUGH_MS } from '../consts/viewLog.mjs';
import createRequest from './createRequest.mjs';
import { formatTime } from './date.mjs';
import { movieMatches } from './movie.mjs';
import {
    printDebug,
    printErr,
    printLog,
    printMsg,
    printWarn,
} from './log.mjs';

/**
 * @typedef {import('./types').Movie} Movie
 * @typedef {import('./types').ViewLog} ViewLog
 */

/**
 * @typedef {object} TraktIds
 * @property {trakt} number
 * @property {string} slug
 * @property {number} tmdb
 * @property {string} imdb
 */

/**
 * @typedef {object} TraktMovie
 * @property {TraktIds} ids
 * @property {string} title
 * @property {number} year
 */

const HTTP_TOO_MANY_REQUESTS = 429;

const TRAKT_API_BASE = 'https://api.trakt.tv/';
const TRAKT_LOOKUP_MIN_SCORE = 1500;
const TRAKT_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const TRAKT_PER_PAGE = 24;

const request = createRequest(TRAKT_API_BASE, {
    createHeaders: () => ({
        'Trakt-API-Version': 2,
        'Trakt-API-Key': config['trakt-client-id'],
    }),
    processResponse: async (response, pathname, requestOptions) => {
        if (
            response.status === HTTP_TOO_MANY_REQUESTS
            && response.headers.has('X-Ratelimit')
            && response.headers.has('Retry-After')
        )
        {
            const rateLimit = JSON.parse(response.headers.get('X-Ratelimit'));
            const retryAfterSec = response.headers.get('Retry-After');
            printDebug('Hit trakt.tv request rate limit', rateLimit.name, '; Will retry in', retryAfterSec, 'seconds');
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve();
                }, retryAfterSec * 1000);
            });
            return request(pathname, requestOptions);
        }
        return response;
    },
});

/**
 * @param {Response} response
 * @return {number}
*/
function getPageCount (response)
{
    const pageCountString = response.headers.get('X-Pagination-Page-Count');
    const pageCount = Number(pageCountString);
    if (Number.isNaN(pageCount))
    {
        throw new Error('Got invalid page count:', pageCountString);
    }
    return pageCount;
}

/**
 * @return {Promise<object>}
 */
async function traktAuth ()
{
    ['trakt-client-id', 'trakt-client-secret'].forEach((name) => {
        assert.ok(config[name], `Required argument --${name} missing.`);
    });

    const codeResponse = await request(new URL('oauth/device/code', TRAKT_API_BASE), {
        method: 'POST',
        body: {
            client_id: config['trakt-client-id'],
        },
    });

    const {
        device_code: deviceCode,
        user_code: userCode,
        verification_url: verificationUrl,
        expires_in: expiresInSec,
        interval: intervalSec,
    } = await codeResponse.json();

    printMsg('Go to', verificationUrl, 'and enter this code:', userCode);

    const checkStop = Date.now() + expiresInSec * 1000;
    return new Promise((resolve, reject) => {
        const queueCheck = () => {
            setTimeout(async () => {
                if (Date.now() >= checkStop)
                {
                    reject();
                }
                else
                {
                    const response = await request(new URL('oauth/device/token', TRAKT_API_BASE), {
                        method: 'POST',
                        body: {
                            code: deviceCode,
                            client_id: config['trakt-client-id'],
                            client_secret: config['trakt-client-secret'],
                        },
                    });

                    if (response.ok)
                    {
                        printMsg('Authenticated in trakt.tv');
                        resolve(response.json());
                    }
                    else
                    {
                        queueCheck();
                    }
                }
            }, intervalSec * 1000);
        };

        queueCheck();
    });
}

/**
 * @param {string} refreshToken
 * @return {Promise<object>}
 */
async function traktRefreshAuth (refreshToken)
{
    printLog('Refreshing trakt.tv access token');

    const response = await request('oauth/token', {
        method: 'POST',
        body: {
            client_id: config['trakt-client-id'],
            client_secret: config['trakt-client-secret'],
            refresh_token: refreshToken,
            redirect_uri: TRAKT_REDIRECT_URI,
            grant_type: 'refresh_token',
        },
    });

    if (!response.ok)
    {
        const { error_description: errMsg } = await response.json();
        printWarn('Failed to refresh trakt.tv token:', errMsg);
        return null;
    }

    return response.json();
}

/**
 * @return {Promise<string>}
 */
async function traktGetAuthToken ()
{
    let hasToken = 'trakt-access-token' in config;
    const hasExpiresAt = 'trakt-expires-at-ms' in config;
    const hasRefreshToken = 'trakt-refresh-token' in config;

    let auth;

    if (hasToken && hasExpiresAt)
    {
        const expiresAt = new Date(config['trakt-expires-at-ms']);
        if (expiresAt <= new Date())
        {
            hasToken = false;
            if (hasRefreshToken)
            {
                auth = await traktRefreshAuth(config['trakt-refresh-token']);
            }
            else
            {
                printMsg('Stored trakt.tv token expired at', formatTime(expiresAt));
            }
        }
    }

    if (!auth && !hasToken)
    {
        auth = await traktAuth();
    }

    if (auth)
    {
        const configUpdate = {
            'trakt-access-token': auth.access_token,
            'trakt-expires-at-ms': (auth.created_at + auth.expires_in) * 1000,
            'trakt-refresh-token': auth.refresh_token,
            // Mostly for debugging purposes
            'trakt-auth-object': auth,
        };
        printMsg('Saving trakt.tv authentication');
        await appendConfig(configUpdate);
    }

    return config['trakt-access-token'];
}

/**
 * @param {TraktMovie}
 * @return {Movie}
 */
function convertTraktMovie (traktMovie)
{
    return {
        title: traktMovie.title,
        year: traktMovie.year,
        services: [
            {
                service: 'trakt',
                id: traktMovie.ids.trakt,
                url: `https://trakt.tv/movies/${traktMovie.ids.slug}`,
            },
            {
                service: 'tmdb',
                id: traktMovie.ids.tmdb,
                url: `https://www.themoviedb.org/movie/${traktMovie.ids.tmdb}`,
            },
            {
                service: 'imdb',
                id: traktMovie.ids.imdb,
                url: `http://www.imdb.com/title/${traktMovie.ids.imdb}`,
            },
        ],
    };
}

/**
 * @param {string} title
 * @param {number|null} year
 * @return {Promise<Movie>}
 */
async function traktLookupMovie (title, year = null)
{
    const url = new URL('search/movie', TRAKT_API_BASE);
    url.searchParams.set('query', title);
    const response = await request(url);

    const results = await response.json();
    const traktMovies = results
        .filter(
            (result) => result.type === 'movie'
              && result.score > TRAKT_LOOKUP_MIN_SCORE
              && (year == null || result.movie.year === year),
        )
        .sort((a, b) => a.score - b.score)
        .map((result) => result.movie);

    if (traktMovies.length === 0)
    {
        return null;
    }

    return convertTraktMovie(traktMovies[0]);
}

async function traktSyncViewLogRequest (viewLog)
{
    if (viewLog.length === 0)
    {
        return [];
    }

    const accessToken = await traktGetAuthToken();

    const response = await request(new URL('sync/history', TRAKT_API_BASE), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: {
            movies: viewLog.map(({ time, movie }) => ({
                watched_at: time.toISOString(),
                title: movie.title,
                year: movie.year,
                ids: {
                    trakt: movie.services?.find((s) => s.service === 'trakt')?.id,
                    tmdb: movie.services?.find((s) => s.service === 'trakt')?.tmdb,
                    imdb: movie.services?.find((s) => s.service === 'trakt')?.imdb,
                },
            })),
        },
    });

    const {
        added: {
            movies: hitCount,
        },
        not_found: {
            movies: misses,
        },
    } = await response.json();

    const viewLogMisses = viewLog.filter(
        ({ movie }) => misses.findIndex(
            (miss) => miss.title === movie.title
              && miss.year === movie.year,
        ) !== -1,
    );

    assert.strictEqual(viewLogMisses.length, viewLog.length - hitCount);

    return viewLogMisses;
}

/**
 * @param {Date} start
 * @param {Date} end
 * @return {Promise<ViewLog>}
 */
async function traktFetchViewLog (start, end)
{
    printLog(
        'Fetching view log from trakt.tv',
        'from', formatTime(start),
        'to', formatTime(end),
    );

    const accessToken = await traktGetAuthToken();

    /** @type ViewLog */
    const viewLog = [];
    for (
        let page = 1;
        page;
        page += 1
    )
    {
        // eslint-disable-next-line no-await-in-loop
        const response = await request('sync/history/movies', {
            searchParams: new URLSearchParams({
                start_at: start.toISOString(),
                end_at: end.toISOString(),
                page,
                limit: TRAKT_PER_PAGE,
            }),
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        // eslint-disable-next-line no-await-in-loop
        const viewLogPage = (await response.json())
            .filter((log) => log.action === 'watch')
            .map(({ watched_at: time, movie }) => ({
                time: new Date(time),
                movie: convertTraktMovie(movie),
            }));

        viewLog.push(...viewLogPage);

        if (page >= getPageCount(response))
        {
            break;
        }
    }

    return viewLog;
}

/**
 * @param {ViewLog} viewLog
 * @return {Promise<void>}
 */
export async function traktSyncViewLog (viewLog)
{
    printMsg('Saving new entries to trakt.tv');

    const times = viewLog.map(({ time }) => time).sort((a, b) => a - b);
    const minTime = new Date(
        times.at(0).getTime() - VIEW_LOG_CLOSE_ENOUGH_MS,
    );
    const maxTime = new Date(
        times.at(-1).getTime() + VIEW_LOG_CLOSE_ENOUGH_MS,
    );

    const traktViewLog =
        await traktFetchViewLog(minTime, maxTime);

    const viewLogNew = viewLog
        .filter(
            ({ time, movie }) => !traktViewLog
                .filter(
                    (h) => Math.abs(h.time - time)
                    < VIEW_LOG_CLOSE_ENOUGH_MS,
                )
                .some((h) => movieMatches(h.movie, movie)),
        );

    printMsg('Entries missing on trakt.tv:', viewLogNew.length);

    const misses =
        await traktSyncViewLogRequest(viewLogNew);

    /** @type {Array<ViewLog>} */
    const lookupMisses = [];
    if (misses.length)
    {
        printLog('Looking up entries that failed to sync to trakt.tv easily (movie name mismatch):', misses.length);

        const viewLogRoundTwo = [];
        (await Promise.all(
            misses.map(async (viewLogEntry) => {
                const { time, movie } = viewLogEntry;
                printDebug('Looking up movie on trakt.tv:', movie);
                const foundMovie =
                    await traktLookupMovie(movie.title, movie.year);
                if (!foundMovie)
                {
                    lookupMisses.push(viewLogEntry);
                }
                else
                {
                    foundMovie.services.push(...movie.services);
                    viewLogRoundTwo.push({
                        time,
                        movie: foundMovie,
                    });
                }
            }),
        ));

        if (viewLogRoundTwo.length)
        {
            printLog('Syncing looked up movies to trakt.tv:', viewLogRoundTwo.length);

            const roundTwoMisses =
              await traktSyncViewLogRequest(viewLogRoundTwo);

            assert.strictEqual(
                roundTwoMisses.length,
                0,
                'Failed to sync view log of entries looked up on trakt.tv',
            );
        }
    }

    if (lookupMisses.length)
    {
        printErr('Failed to look up', lookupMisses.length, 'movies on trakt.tv.');
        lookupMisses.forEach(({ time, movie }) => {
            printLog('-', movie.title, `(${movie.year})`);
            printLog('  watched at ', formatTime(time));
            printLog('  ', movie.services.map((s) => s.url).join(' '));
        });
    }
    else
    {
        printMsg('Saved', viewLog.length, 'entries on trakt.tv');
    }

    return lookupMisses.length === 0;
}
