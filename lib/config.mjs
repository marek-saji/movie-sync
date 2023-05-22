import configFromFile, { configFileInit } from './configFile.mjs';
import args, { argsInit } from './args.mjs';

export default new Proxy({}, {
    get (_target, prop) {
        return prop in args ? args[prop] : configFromFile[prop];
    },
});
