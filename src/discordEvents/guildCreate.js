export default {
    name: 'guildCreate',
    async execute(client, guild) {
        require('../util/CreateInstanceFile')(client, guild);
        require('../util/CreateCredentialsFile')(client, guild);
        require('../util/CreateAuthTokensFile')(client, guild);
        client.fcmListenersLite[guild.id] = new Object();

        client.loadGuildIntl(guild.id);

        await client.setupGuild(guild);
    },
};
