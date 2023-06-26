import configFromFile from './configFile.mjs';
import args, { options } from './args.mjs';
import { APP_ID } from '../consts/app.mjs';

/**
 * @param {string} name
 * @return {string}
 */
function get (name)
{
    return [
        args[name],
        configFromFile[name],
        options[name]?.defaultValue,
    ].filter((value) => value !== undefined).at(0);
}

export default new Proxy({}, {
    has (_target, prop) {
        return get(prop) !== undefined;
    },
    get (_target, prop) {
        return get(prop);
    },
});
