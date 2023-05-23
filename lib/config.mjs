import configFromFile from './configFile.mjs';
import args from './args.mjs';

export default new Proxy({}, {
    has (_target, prop) {
        return prop in args || prop in configFromFile;
    },
    get (_target, prop) {
        return prop in args ? args[prop] : configFromFile[prop];
    },
});
