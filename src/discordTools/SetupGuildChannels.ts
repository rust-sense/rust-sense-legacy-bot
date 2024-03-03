import DiscordTools from '../discordTools/discordTools.js';

import PermissionHandler from '../handlers/permissionHandler.js';

export default async (client, guild, category) => {
    await addTextChannel(client.intlGet(guild.id, 'channelNameInformation'), 'information', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameServers'), 'servers', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameSettings'), 'settings', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameCommands'), 'commands', client, guild, category, true);
    await addTextChannel(client.intlGet(guild.id, 'channelNameEvents'), 'events', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameTeamchat'), 'teamchat', client, guild, category, true);
    await addTextChannel(client.intlGet(guild.id, 'channelNameSwitches'), 'switches', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameSwitchGroups'), 'switchGroups', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameAlarms'), 'alarms', client, guild, category);
    await addTextChannel(
        client.intlGet(guild.id, 'channelNameStorageMonitors'),
        'storageMonitors',
        client,
        guild,
        category,
    );
    await addTextChannel(client.intlGet(guild.id, 'channelNameActivity'), 'activity', client, guild, category);
    await addTextChannel(client.intlGet(guild.id, 'channelNameTrackers'), 'trackers', client, guild, category);
};

async function addTextChannel(name, idName, client, guild, parent, permissionWrite = false) {
    const instance = client.getInstance(guild.id);

    let channel = undefined;
    if (instance.channelId[idName] !== null) {
        channel = DiscordTools.getTextChannelById(guild.id, instance.channelId[idName]);
    }
    if (channel === undefined) {
        channel = await DiscordTools.addTextChannel(guild.id, name);
        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        instance.channelId[idName] = channel.id;
        client.setInstance(guild.id, instance);

        try {
            // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
            channel.setParent(parent.id);
        } catch (e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
                client.intlGet(null, 'couldNotSetParent', { channelId: channel.id }),
                'error',
            );
        }
    }

    if (instance.firstTime) {
        try {
            // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
            channel.setParent(parent.id);
        } catch (e) {
            client.log(
                client.intlGet(null, 'errorCap'),
                // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
                client.intlGet(null, 'couldNotSetParent', { channelId: channel.id }),
                'error',
            );
        }
    }

    const perms = PermissionHandler.getPermissionsReset(client, guild, permissionWrite);

    try {
        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        await channel.permissionOverwrites.set(perms);
    } catch (e) {
        /* Ignore */
    }

    /* Currently, this halts the entire application... Too lazy to fix...
       It is possible to just remove the channels and let the bot recreate them with correct name language */
    //channel.setName(name);

    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    channel.lockPermissions();
}
