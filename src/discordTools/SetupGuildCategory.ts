import DiscordTools from '../discordTools/discordTools.js';

import PermissionHandler from '../handlers/permissionHandler.js';

export default async (client, guild) => {
    const instance = client.getInstance(guild.id);

    let category = undefined;
    if (instance.channelId.category !== null) {
        category = DiscordTools.getCategoryById(guild.id, instance.channelId.category);
    }
    if (category === undefined) {
        category = await DiscordTools.addCategory(guild.id, 'rustplusplus');
        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        instance.channelId.category = category.id;
        client.setInstance(guild.id, instance);
    }

    const perms = PermissionHandler.getPermissionsReset(client, guild, false);

    try {
        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        await category.permissionOverwrites.set(perms);
    } catch (e) {
        /* Ignore */
    }

    return category;
};
