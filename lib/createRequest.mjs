import config from './config.mjs';

/**
 * @typedef {object} CreateRequestOptions
 * @property {() => Record<string, string>} createHeaders
 * @property {(response: Response) => Response} processResponse
 */

/**
 * @param {string} apiBase
 * @param {CreateRequestOptions} options
 */
export default (
    apiBase,
    {
        createHeaders = () => ({}),
        processResponse = (r) => r,
    } = {},
) => {
    /**
     * @param {string} pathname
     * @param {RequestInit & { searchParams: URLSearchParams }} options
     * @return {Promise<any>}
     */
    const request = async (
        pathname,
        { searchParams, ...options } = {},
    ) => {
        const url = new URL(pathname, apiBase);
        Array.from(searchParams?.entries() || [])
            .forEach(([name, value]) => {
                url.searchParams.append(name, value);
            });

        const body =
                options.body ? JSON.stringify(options.body) : undefined;
        const headers = {
            'Content-Type': 'application/json',
            'Accept-Language': config.language,
            ...createHeaders(),
            ...options.headers,
        };

        const resolvedOptions = {
            method: 'GET',
            ...options,
            body,
            headers,
        };

        console.debug(resolvedOptions.method, url.toString());

        const response = await fetch(url, resolvedOptions);

        return processResponse(
            response,
            pathname,
            { searchParams, ...options },
        );
    };

    return request;
};
