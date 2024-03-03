import Axios from 'axios';

import Constants from '../util/constants.js';
import Utils from '../util/utils.js';

export default {
    scrape: async function (url) {
        try {
            return await Axios.get(url);
        } catch (e) {
            return {};
        }
    },

    scrapeSteamProfilePicture: async function (client, steamId) {
        const response = await module.exports.scrape(`${Constants.STEAM_PROFILES_URL}${steamId}`);

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

        const png = response.data.match(/<img src="(.*_full.jpg)(.*?(?="))/);
        if (png) {
            return png[1];
        }

        return null;
    },

    scrapeSteamProfileName: async function (client, steamId) {
        const response = await module.exports.scrape(`${Constants.STEAM_PROFILES_URL}${steamId}`);

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

        const regex = new RegExp(`class="actual_persona_name">(.+?)</span>`, 'gm');
        const data = regex.exec(response.data);
        if (data) {
            return Utils.decodeHtml(data[1]);
        }

        return null;
    },
};
