import args from './args.mjs';

/**
 * @param {string} apiBase
 * @param {RequestInit & { processResponse: (r: Response) => Response }} defaultOptions
 */
export default (
    apiBase,
    {
        processResponse = (r) => r,
        ...defaultOptions
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
            'Accept-Language': args.language,
            ...defaultOptions.headers,
            ...options.headers,
        };

        const resolvedOptions = {
            method: 'GET',
            ...defaultOptions,
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
