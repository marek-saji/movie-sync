import { parseArgs } from 'node:util';

import stripAnsi from 'strip-ansi';
import { stdout as supportsHyperlinksOnStdout } from 'supports-hyperlinks';
import hyperlinker from 'hyperlinker';

import { EX_USAGE } from '../consts/exitCodes.mjs';

import { getConfigPath } from './configFile.mjs';

/**
 * @param {string} uri
 * @param {string} text
 */
function link (uri, text)
{
    if (supportsHyperlinksOnStdout)
    {
        return hyperlinker(text, uri);
    }
    return `<${uri}>`;
}

// Note: Not using 'default' that’s understood by parseArgs, but a
// custom defaultValue, because we want to usevalue from config file,
// before falling back to default
export const options = {
    help: {
        type: 'boolean',
        short: 'h',
        description: 'Show this help.',
    },
    verbose: {
        type: 'boolean',
        multiple: true,
        short: 'v',
        description: 'Be more verbose.',
        defaultValue: [],
    },
    since: {
        type: 'string',
        short: 's',
        description: `Fetch view logs only from given date. See ${link('https://github.com/nrkno/simple-date-parse', 'simple-date-parse')} for syntax.`,
        defaultValue: '-1 month',
    },
    language: {
        type: 'string',
        short: 'l',
        description: 'Language. Used as Accept-Language header value.',
        defaultValue: 'en',
    },
    'mubi-token': {
        type: 'string',
        description: `Token for communicating with mubi API. To get it, navigate to ${link('https://mubi.com', 'Mubi page')} with devtools open and look for requests to the API. Check value of 'Authorization' token and copy part after 'Bearer' from there.`,
    },
    // TODO Can we auto-detect mubi country somehow?
    'mubi-country': {
        type: 'string',
        description: "Country you are accessing Mubi from. You can find it simiar to value for --mubi-token, but look for 'Client-Country' header.",
    },
    'trakt-client-id': {
        type: 'string',
        description: `Go to ${link('https://trakt.tv/oauth/applications/', '“Your API Keys” on Trakt.tv')} and create an app. Use "urn:ietf:wg:oauth:2.0:oob" for "Redirect URI" and grant "checkin" and "scrobble" permissions.`,
    },
    'trakt-client-secret': {
        type: 'string',
        description: 'See --trakt-client-id.',
    },
    'trakt-access-token': {
        type: 'string',
        description: 'If you don’t specify this, you will be asked to authenticate to trakt.tv and token will be stored in the config file.',
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

    return text.split('\n').map((line) => {
        const words = [];
        let lineLength = 0;
        line.split(' ').forEach((word) => {
            if (lineLength + 1 + word.length > width)
            {
                words.push('\n');
                lineLength = 0;
            }
            else if (words.length)
            {
                words.push(' ');
                lineLength += 1;
            }
            words.push(word);
            lineLength += stripAnsi(word).length;
        });
        return words.join('');
    }).join('\n');
}

export function printHelp ()
{
    const useColors = process.stdout.hasColors?.();

    const reset = useColors ? '\x1b[0m' : '';
    const strong = useColors ? '\x1b[1m' : '';
    const emphasis = useColors ? '\x1b[32m' : '';
    const dim = useColors ? '\x1b[2m' : '';

    process.stdout.write(`${strong}Sync watch state between different services.${reset}\n`);
    process.stdout.write(`${dim}(Currently only from mubi.com to trakt.tv)${reset}\n`);
    process.stdout.write('\n');
    process.stdout.write(`Usage: ${strong}npx @saji/movie-sync OPTIONS${reset}\n\n`);
    process.stdout.write(`${strong}OPTIONS${reset}\n\n`);

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
            emphasis + optHelp[opt].padEnd(optHelpMaxLength) + reset,
        );
        let { description } = optDef;
        if (optDef.multiple)
        {
            description += ` ${dim}Can be given multiple times.${reset}`;
        }
        if ('defaultValue' in optDef)
        {
            const { defaultValue } = optDef;
            if (!(
                Array.isArray(defaultValue)
                && defaultValue.length === 0
            ))
            {
                description += ` ${dim}(default: ${optDef.defaultValue})${reset}`;
            }
        }
        description =
            wrap(description, optHelpMaxLength)
                .replaceAll('\n', '\n'.padEnd(optHelpMaxLength + 1));
        process.stdout.write(description);
        process.stdout.write('\n');
    });

    process.stdout.write('\n');

    process.stdout.write(`${strong}CONFIG FILE${reset}\n\n`);

    const configFilePath = getConfigPath();
    const configFileUri = `file:${configFilePath}`;
    process.stdout.write(`You can use the same (long) option names to set options in JSON config file: ${link(configFileUri, configFilePath)}. Arguments that can be specified multiple times must be specified as arrays.\n`);

    process.exit(0);
}
