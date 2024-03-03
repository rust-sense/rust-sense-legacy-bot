import DiscordTools from '../discordTools/discordTools.js';

export default async (client, guild) => {
    const instance = client.getInstance(guild.id);

    let categoryId = null;
    for (const [channelName, channelId] of Object.entries(instance.channelId)) {
        if (channelName === 'category') {
            // @ts-expect-error TS(2322) FIXME: Type 'unknown' is not assignable to type 'null'.
            categoryId = channelId;
            continue;
        }

        await DiscordTools.removeTextChannel(guild.id, channelId);
        instance.channelId[channelName] = null;
    }

    await DiscordTools.removeCategory(guild.id, categoryId);
    instance.channelId['category'] = null;

    client.setInstance(guild.id, instance);
};
