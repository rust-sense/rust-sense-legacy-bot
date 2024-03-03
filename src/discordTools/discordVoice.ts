import { createAudioPlayer, createAudioResource, getVoiceConnection } from '@discordjs/voice';

// @ts-expect-error TS(2732) FIXME: Cannot find module '../staticFiles/actors.json'. C... Remove this comment to see the full error message
import Actors from '../staticFiles/actors.json';
// @ts-expect-error TS(2691) FIXME: An import path cannot end with a '.ts' extension. ... Remove this comment to see the full error message
import Client from '../../index.ts';

export default {
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
        const instance = Client.client.getInstance(guildId);
        const gender = instance.generalSettings.voiceGender;
        const language = instance.generalSettings.language;

        if (Actors[language]?.[gender] === null || Actors[language]?.[gender] === undefined) {
            return Actors[language]?.[gender === 'male' ? 'female' : 'male'];
        } else {
            return Actors[language]?.[gender];
        }
    },
};
