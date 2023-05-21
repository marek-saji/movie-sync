import assert from 'node:assert';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import envPaths from 'env-paths';

import args from './args.mjs';
import createRequest from './createRequest.mjs';

/**
 * @typedef {object} TraktMovie
 * @property {{ trakt: number, tmdb: number, slug: string, imdb: string }} ids
 * @property {string} title
 * @property {number} year
 */

const HTTP_TOO_MANY_REQUESTS = 429;

const VIEW_LOG_CLOSE_ENOUGH_MS = 15 * 60 * 1000;

const TRAKT_API_BASE = 'https://api.trakt.tv/';
const TRAKT_LOOKUP_MIN_SCORE = 1500;

const timeFormatter = new Intl.DateTimeFormat(args.language, {
    dateStyle: 'short',
    timeStyle: 'long',
});

const request = createRequest(TRAKT_API_BASE, {
    headers: {
        'Content-Type': 'application/json',
        'Accept-Language': args.language,
        'Trakt-API-Version': 2,
        'Trakt-API-Key': args['trakt-client-id'],
    },
    processResponse: async (response, pathname, requestOptions) => {
        if (
            response.status === HTTP_TOO_MANY_REQUESTS
            && response.headers.has('X-Ratelimit')
            && response.headers.has('Retry-After')
        )
        {
            const rateLimit = JSON.parse(response.headers.get('X-Ratelimit'));
            const retryAfterSec = response.headers.get('Retry-After');
            console.debug('Hit request rate limit', rateLimit.name, '; Will retry in', retryAfterSec, 'seconds');
            await new Promise((resolve) => {
                setTimeout(() =>
                { resolve();
                }, retryAfterSec * 1000);
            });
            return request(pathname, requestOptions);
        }
        return response;
    },
});

/**
 * @param {string} title
 * @return {string}
 */
function normaliseTitle (title)
{
    return title.toLowerCase().replace(/[:-\s]+/g, ' ');
}

/**
 * @param {Movie} movieA
 * @param {Movie} movieB
 * @return {boolean}
 */
function movieMatches (movieA, movieB)
{
    const serviceMatch = movieA.services.some(
        (serviceA) => movieB.services.some(
            (serviceB) => serviceA.service === serviceB
                && serviceA.id === serviceB.id,
        ),
    );
    if (serviceMatch)
    {
        return true;
    }

    if (movieA.year !== movieB.year)
    {
        return false;
    }

    return (
        normaliseTitle(movieA.title) === normaliseTitle(movieB.title)
    );
}

/**
 * @return {object}
 */
async function traktAuth ()
{
    ['trakt-client-id', 'trakt-client-secret'].forEach((name) => {
        assert(args[name], `Required argument --${name} missing.`);
    });

    const codeResponse = await request(new URL('oauth/device/code', TRAKT_API_BASE), {
        method: 'POST',
        body: {
            client_id: args['trakt-client-id'],
        },
    });

    const {
        device_code: deviceCode,
        user_code: userCode,
        verification_url: verificationUrl,
        expires_in: expiresInSec,
        interval: intervalSec,
    } = await codeResponse.json();

    process.stdout.write(`Go to <${verificationUrl}> and enter this code: ${userCode}\n`);

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
                            client_id: args['trakt-client-id'],
                            client_secret: args['trakt-client-secret'],
                        },
                    });

                    if (response.ok)
                    {
                        process.stdout.write('Activated.\n');
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
 * @return {string}
 */
async function traktGetAuthToken ()
{
    const configDir = envPaths('@saji/sync-movies', { suffix: '' }).config;
    await mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, 'config.json');
    if (!existsSync(configPath))
    {
        await writeFile(configPath, '{}');
    }

    const contents = await readFile(configPath, { encoding: 'utf-8' });
    const config = JSON.parse(contents);

    if (!config?.traktAuth)
    {
        config.traktAuth = await traktAuth();
        await writeFile(configPath, JSON.stringify(config, null, 2));
    }

    // TODO Check if token is still valid & refresh

    return config.traktAuth.access_token;
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
 * @return {Movie}
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
 * @return {ViewLog}
 */
async function traktFetchHistory (start, end)
{
    const accessToken = await traktGetAuthToken();

    const response = await request('sync/history/movies', {
        searchParams: new URLSearchParams({
            start_at: start.toISOString(),
            end_at: end.toISOString(),
        }),
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    // TODO Paginate
    return (await response.json())
        .filter((log) => log.action === 'watch')
        .map(({ watched_at: time, movie }) => ({
            time: new Date(time),
            movie: convertTraktMovie(movie),
        }));
}

/**
 * @param {ViewLog} viewLog
 * @return {void}
 */
export async function traktSyncViewLog (viewLog)
{
    const times = viewLog.map(({ time }) => time).sort((a, b) => a - b);
    const minTime = new Date(
        times.at(0).getTime() - VIEW_LOG_CLOSE_ENOUGH_MS,
    );
    const maxTime = new Date(
        times.at(-1).getTime() + VIEW_LOG_CLOSE_ENOUGH_MS,
    );

    const history =
        await traktFetchHistory(minTime, maxTime);

    const viewLogNew = viewLog
        .filter(
            ({ time, movie }) => !history
                .filter(
                    (h) => Math.abs(h.time - time) < VIEW_LOG_CLOSE_ENOUGH_MS,
                )
                .some((h) => movieMatches(h.movie, movie)),
        );

    process.stdout.write(`Already logged movies: ${viewLog.length - viewLogNew.length}\n`);

    const misses =
        await traktSyncViewLogRequest(viewLogNew);

    const viewLogRoundTwo = [];
    const lookupMisses = [];
    (await Promise.all(
        misses.map(async (viewLogEntry) => {
            const { time, movie } = viewLogEntry;
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

    const roundTwoMisses =
      await traktSyncViewLogRequest(viewLogRoundTwo);

    const totalMisses = [
        ...lookupMisses,
        ...roundTwoMisses,
    ];

    if (totalMisses.length)
    {
        process.stderr.write('Failed to look up some of the movies on trakt.tv:\n');
        totalMisses.forEach(({ time, movie }) => {
            process.stderr.write(`- ${movie.title} (${movie.year})\n`);
            process.stderr.write(`  watched at ${timeFormatter.format(time)}\n`);
            process.stderr.write(`  ${movie.services.map((s) => s.url).join(' ')}\n`);
        });
    }

    return totalMisses.length === 0;
}
