const InstanceUtils = require('../util/instanceUtils');

export default {
    name: 'guildMemberRemove',
    async execute(client, member) {
        const guildId = member.guild.id;
        const userId = member.user.id;

        const credentials = InstanceUtils.readCredentialsFile(guildId);

        const steamId = Object.keys(credentials).find((e) => credentials[e] && credentials[e].discordUserId === userId);

        if (!(steamId in credentials)) return;

        if (steamId === credentials.hoster) {
            if (client.fcmListeners[guildId]) {
                client.fcmListeners[guildId].destroy();
            }
            delete client.fcmListeners[guildId];
            credentials.hoster = null;
        } else {
            if (client.fcmListenersLite[guildId][steamId]) {
                client.fcmListenersLite[guildId][steamId].destroy();
            }
            delete client.fcmListenersLite[guildId][steamId];
        }

        delete credentials[steamId];
        InstanceUtils.writeCredentialsFile(guildId, credentials);
    },
};
