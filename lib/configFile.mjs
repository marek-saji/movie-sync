import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import envPaths from 'env-paths';

/**
 * @typedef {object} Config
 */
const config = {};

export default config;

/**
 * @return {string}
 */
function getConfigDir ()
{
    return envPaths('@saji/sync-movies', { suffix: '' }).config;
}

/**
 * @return {string}
 */
export function getConfigPath ()
{
    return path.join(getConfigDir(), 'config.json');
}

/**
 * @param {Config} newConfig
 * @return {void}
 */
export const appendConfig = async (partial) => {
    Object.assign(config, partial);

    const configPath = getConfigPath();
    const contentsJson = JSON.stringify(config, null, 2);
    await writeFile(configPath, contentsJson);
};

/**
 * @return {void}
 */
export const configFileInit = async () => {
    const configDir = getConfigDir();
    await mkdir(configDir, { recursive: true });
    const configPath = getConfigPath();
    if (!existsSync(configPath))
    {
        await saveConfig({});
    }
    else
    {
        const contentsJson = await readFile(configPath, { encoding: 'utf-8' });
        const contents = JSON.parse(contentsJson);
        Object.assign(config, contents);
    }

    return configPath;
};
