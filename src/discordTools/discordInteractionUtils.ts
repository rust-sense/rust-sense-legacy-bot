import * as Discord from 'discord.js';

export function generateVerifyId(): number {
    return Math.floor(100000 + Math.random() * 900000);
}

export function isBlacklisted(client: any, instance: any, interaction: any, verifyId: string | number): boolean {
    if (
        instance.blacklist['discordIds'].includes(interaction.user.id) &&
        !interaction.member.permissions.has(Discord.PermissionsBitField.Flags.Administrator)
    ) {
        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'userPartOfBlacklist', {
                id: `${verifyId}`,
                user: `${interaction.user.username} (${interaction.user.id})`,
            }),
        );
        return true;
    }
    return false;
}

export async function resolveItemId(
    client: any,
    interaction: any,
    guildId: string,
    itemName: string | null,
    itemId: string | null,
): Promise<string | null> {
    const DiscordEmbeds = await import('./discordEmbeds.js');
    if (itemName !== null) {
        const item = client.items.getClosestItemIdByName(itemName);
        if (item === null) {
            const str = client.intlGet(guildId, 'noItemWithNameFound', { name: itemName });
            await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(guildId, 'warningCap'), str);
            return null;
        }
        return item;
    } else if (itemId !== null) {
        if (client.items.itemExist(itemId)) {
            return itemId;
        }
        const str = client.intlGet(guildId, 'noItemWithIdFound', { id: itemId });
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(guildId, 'warningCap'), str);
        return null;
    } else {
        const str = client.intlGet(guildId, 'noNameIdGiven');
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(guildId, 'warningCap'), str);
        return null;
    }
}
