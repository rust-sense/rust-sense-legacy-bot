const { getVoiceConnection, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
import { client } from '../index';

import { loadJsonResourceSync } from '../utils/filesystemUtils';
const Actors = loadJsonResourceSync('staticFiles/actors.json');

module.exports = {
    sendDiscordVoiceMessage: async function (guildId, text) {
        const connection = getVoiceConnection(guildId);
        const voice = await this.getVoice(guildId);
        const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;

        if (connection) {
            const stream = (await (await fetch(url)).blob()).stream();
            const resource = createAudioResource(stream);
            const player = createAudioPlayer();
            connection.subscribe(player);
            player.play(resource);
        }
    },

    getVoice: async function (guildId) {
        const instance = client.getInstance(guildId);
        const gender = instance.generalSettings.voiceGender;
        const language = instance.generalSettings.language;

        if (Actors[language]?.[gender] === null || Actors[language]?.[gender] === undefined) {
            return Actors[language]?.[gender === 'male' ? 'female' : 'male'];
        }

        return Actors[language]?.[gender];
    },
};
