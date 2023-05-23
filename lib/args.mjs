import { parseArgs } from 'node:util';

import { EX_USAGE } from '../consts/exitCodes.mjs';

import { getConfigPath } from './configFile.mjs';

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
    'trakt-access-token': {
        type: 'string',
        description: 'If you don’t specify this, you will be asked to authenticate to trakt.tv and token will be stored in the config file',
    },
};

const args = {};
export default args;

export const argsInit = () => {
    try
    {
        const { values } = parseArgs({
            options,
        });

        Object.assign(args, values);

        return args;
    }
    catch (error)
    {
        if (error instanceof TypeError && error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION')
        {
            process.stderr.write(`ERROR: ${error.message}. Run with --help for more info.\n`);
            process.exit(EX_USAGE);
        }
        throw error;
    }
};

function wrap (text, margin = 0)
{
    if (!process.stdout?.columns)
    {
        return text;
    }

    const width = process.stdout.columns - margin;

    const words = [];
    let lineLength = 0;
    text.split(' ').forEach((word) => {
        lineLength += 1 + word.length;
        if (lineLength > width)
        {
            lineLength = 0;
            words.push('\n');
        }
        else if (words.length)
        {
            lineLength += 1;
            words.push(' ');
        }
        words.push(word);
    });
    return words.join('');
}

export function printHelp ()
{
    process.stdout.write('Sync watch state between different services.\n');
    process.stdout.write('(Currently only from mubi.com to trakt.tv)\n');
    process.stdout.write('\n');
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
        let { description } = optDef;
        if ('default' in optDef)
        {
            description += ` (default: ${optDef.default})`;
        }
        description =
            wrap(description, optHelpMaxLength)
                .replaceAll('\n', '\n'.padEnd(optHelpMaxLength + 1));
        process.stdout.write(description);
        process.stdout.write('\n');
    });

    process.stdout.write('\n');

    const configFilePath = getConfigPath();
    process.stdout.write(wrap(`You can also use the same (long) option names to set them in JSON config file: ${configFilePath}\n`));

    process.exit(0);
}
