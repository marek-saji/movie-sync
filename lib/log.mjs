import { format } from 'node:util';

import config from './config.mjs';

/**
 * @param {number} level
 * @param {import('fs').WriteStream} stream
 * @param {string|null} prefix
 * @param {number|null} color
 * @param {...any} args
 * @return {void}
 */
const writeLog = (level, stream, prefix, color, ...args) => {
    if ((config.verbose?.length || 0) < level)
    {
        return;
    }

    const useColor = color && stream.hasColors?.();

    stream.write([
        useColor ? `\x1b[${color}m` : '',
        prefix ? `${prefix}: ` : '',
        format(...args),
        useColor ? '\x1b[0m' : '',
        '\n',
    ].join(''));
};

const warnColor = 33;
const errorColor = 31;
const debugColor = 2;

export const printMsg = writeLog.bind(
    null, 0, process.stdout, null, null,
);
export const printLog = writeLog.bind(
    null, 1, process.stdout, null, null,
);
export const printErr = writeLog.bind(
    null, 0, process.stderr, 'ERROR', errorColor,
);
export const printWarn = writeLog.bind(
    null, 1, process.stderr, 'WARNING', warnColor,
);
export const printDebug = writeLog.bind(
    null, 2, process.stdout, 'DEBUG', debugColor,
);
