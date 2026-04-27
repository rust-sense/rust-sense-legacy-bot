import Axios from 'axios';

import * as Constants from './constants.js';

export async function scrape(url: string): Promise<{ status?: number; data?: string }> {
    try {
        return await Axios.get(url);
    } catch (_e) {
        return {};
    }
}

export async function scrapeSteamProfilePicture(
    client: { log: (title: string, message: string, level: string) => void; intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string },
    steamId: string,
): Promise<string | null> {
    const response = await scrape(`${Constants.STEAM_PROFILES_URL}${steamId}`);

    if (response.status !== 200) {
        client.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'failedToScrapeProfilePicture', {
                link: `${Constants.STEAM_PROFILES_URL}${steamId}`,
            }),
            'error',
        );
        return null;
    }

    const png = response.data?.match(/<img src="(.*_full.jpg)(.*?(?="))/);
    if (png && png[1]) {
        return png[1];
    }

    return null;
}

export async function scrapeSteamProfileName(
    client: { log: (title: string, message: string, level: string) => void; intlGet: (guildId: string | null, key: string, options?: Record<string, unknown>) => string },
    steamId: string,
): Promise<string | null> {
    const response = await scrape(`${Constants.STEAM_PROFILES_URL}${steamId}`);

    if (response.status !== 200) {
        client.log(
            client.intlGet(null, 'errorCap'),
            client.intlGet(null, 'failedToScrapeProfileName', {
                link: `${Constants.STEAM_PROFILES_URL}${steamId}`,
            }),
            'error',
        );
        return null;
    }

    const name = response.data?.match(/<span class="actual_persona_name">(.*?(?=<\/span>))/);
    if (name && name[1]) {
        return name[1];
    }

    return null;
}
