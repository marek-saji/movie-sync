import config from './config.mjs';

/**
 * @param {string} apiBase
 * @param {{ processResponse: (r: Response) => Response, createHeaders: () => Record<string, string>}} options
 */
export default (
    apiBase,
    {
        processResponse = (r) => r,
        createHeaders = () => ({}),
    } = {},
) =>
    /**
     * @param {string} pathname
     * @param {RequestInit & { searchParams: URLSearchParams }} options
     * @return {any}
     */
    async (
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
