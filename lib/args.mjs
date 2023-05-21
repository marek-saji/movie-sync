import { parseArgs } from 'node:util';

export const options = {
    help: {
        type: 'boolean',
        short: 'h',
        description: 'Show this help.',
    },
    language: {
        type: 'string',
        short: 'l',
        description: 'Language. Used as Accept-Language header value.',
        default: 'en',
    },
    'mubi-token': {
        type: 'string',
        description: 'Token for communicating with mubi API. To get it, navigate to <https://mubi.com> with devtools open and look for requests to the API. Check value of \'Authorization\' token and copy part after \'Bearer\' from there.',
    },
    // TODO Can we auto-detect mubi country somehow?
    'mubi-country': {
        type: 'string',
        description: "Country you are accessing Mubi from. You can find it simiar to value for --mubi-token, but look for 'Client-Country' header.",
    },
    'trakt-client-id': {
        type: 'string',
        description: '<https://trakt.tv/oauth/applications/>',
    },
    'trakt-client-secret': {
        type: 'string',
        description: '<https://trakt.tv/oauth/applications/>',
    },
};

const { values: args } = parseArgs({
    // TODO Read most options from config file as well
    options,
});

export function printHelp ()
{
    process.stdout.write('Sync watch state between different services.\n\n');
    process.stdout.write('Usage: npx @saji/movie-sync OPTIONS\n\n');
    process.stdout.write('Options:\n');

    const optHelp = Object.fromEntries(
        Object.entries(options).map(
            ([name, opt]) => [
                name,
                `  --${name}${opt.short ? `, -${opt.short}` : ''}  `,
            ],
        ),
    );
    const optHelpMaxLength = Math.max(
        ...Object.values(optHelp).map((h) => h.length),
    );
    Object.entries(options).forEach(([opt, optDef]) => {
        process.stdout.write(
            optHelp[opt].padEnd(optHelpMaxLength),
        );
        process.stdout.write(optDef.description);
        if ('default' in optDef)
        {
            process.stdout.write(` (default: ${optDef.default})`);
        }
        process.stdout.write('\n');
    });
    process.exit(0);
}

export default args;
