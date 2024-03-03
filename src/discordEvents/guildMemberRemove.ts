import InstanceUtils from '../util/instanceUtils.js';

export default {
    name: 'guildMemberRemove',
    async execute(client, member) {
        const guildId = member.guild.id;
        const userId = member.user.id;

        const credentials = InstanceUtils.readCredentialsFile(guildId);

        const steamId = Object.keys(credentials).find((e) => credentials[e] && credentials[e].discordUserId === userId);

        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        if (!(steamId in credentials)) return;

        if (steamId === credentials.hoster) {
            if (client.fcmListeners[guildId]) {
                client.fcmListeners[guildId].destroy();
            }
            delete client.fcmListeners[guildId];
            credentials.hoster = null;
        } else {
            // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
            if (client.fcmListenersLite[guildId][steamId]) {
                // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
                client.fcmListenersLite[guildId][steamId].destroy();
            }
            // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
            delete client.fcmListenersLite[guildId][steamId];
        }

        // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
        delete credentials[steamId];
        InstanceUtils.writeCredentialsFile(guildId, credentials);
    },
};
