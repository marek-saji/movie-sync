import config from './config.mjs';

const timeFormatter = new Intl.DateTimeFormat(config.language, {
    dateStyle: 'short',
    timeStyle: 'long',
});

/**
 * @param {Date} time
 * @return {string}
 */
export const formatTime = (time) => timeFormatter.format(time);
