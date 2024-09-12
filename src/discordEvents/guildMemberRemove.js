const InstanceUtils = require('../util/instanceUtils');

export default {
    name: 'guildMemberRemove',
    async execute(client, member) {
        const guildId = member.guild.id;
        const userId = member.user.id;

        //const credentials = InstanceUtils.readCredentialsFile(guildId);
        const authTokens = InstanceUtils.readAuthTokensFile(guildId);

        const steamId = Object.keys(authTokens).find(e => authTokens[e] && authTokens[e].discordUserId === userId);

        //if (!(steamId in credentials)) return;
        if (!(steamId in authTokens)) return;

        if (client.authTokenListenerIntervalsIds[guildId] &&
            client.authTokenListenerIntervalsIds[guildId][steamId]) {
            clearInterval(client.authTokenListenerIntervalsIds[guildId][steamId]);
            delete client.authTokenListenerIntervalsIds[guildId][steamId];
        }

        if (steamId === authTokens.hoster) {
            authTokens.hoster = null;
        }

        //delete credentials[steamId];
        delete authTokens[steamId];
        //InstanceUtils.writeCredentialsFile(guildId, credentials);
        InstanceUtils.writeAuthTokensFile(guildId, authTokens);
    },
}
