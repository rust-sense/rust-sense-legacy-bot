import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import type { DiscordBot } from '../types/discord.js';

const DiscordEmbedsAny = DiscordEmbeds as any;

export default {
    name: 'leader',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('leader')
            .setDescription(client.intlGet(guildId, 'commandsLeaderDesc'))
            .addStringOption((option) =>
                option
                    .setName('member')
                    .setDescription(client.intlGet(guildId, 'commandsLeaderMemberDesc'))
                    .setRequired(true),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const instance = client.getInstance(interaction.guildId);
        const rustplus = (client as any).rustplusInstances[interaction.guildId];

        const verifyId = (client as any).generateVerifyId();
        (client as any).logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await (client as any).validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.options.getString('member');

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${member}`,
            }),
            'info',
        );

        if (!rustplus || (rustplus && !rustplus.isOperational)) {
            const str = client.intlGet(interaction.guildId, 'notConnectedToRustServer');
            await (client as any).interactionEditReply(interaction, DiscordEmbedsAny.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warning');
            return;
        }

        if (!rustplus.generalSettings.leaderCommandEnabled) {
            const str = client.intlGet(interaction.guildId, 'leaderCommandIsDisabled');
            await (client as any).interactionEditReply(
                interaction,
                DiscordEmbedsAny.getActionInfoEmbed(1, str, instance.serverList[rustplus.serverId].title),
            );
            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warning');
            return;
        }

        if (!Object.keys(instance.serverListLite[rustplus.serverId]).includes(rustplus.team.leaderSteamId)) {
            let names = '';
            for (const player of rustplus.team.players) {
                if (Object.keys(instance.serverListLite[rustplus.serverId]).includes(player.steamId)) {
                    names += `${player.name}, `;
                }
            }
            names = names.slice(0, -2);

            const str = client.intlGet(rustplus.guildId, 'leaderCommandOnlyWorks', { name: names });
            await (client as any).interactionEditReply(
                interaction,
                DiscordEmbedsAny.getActionInfoEmbed(1, str, instance.serverList[rustplus.serverId].title),
            );
            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warning');
            return;
        }

        for (const player of rustplus.team.players) {
            if (player.name.includes(member)) {
                if (rustplus.team.leaderSteamId === player.steamId) {
                    const str = client.intlGet(interaction.guildId, 'leaderAlreadyLeader', {
                        name: player.name,
                    });
                    await (client as any).interactionEditReply(
                        interaction,
                        DiscordEmbedsAny.getActionInfoEmbed(1, str, instance.serverList[rustplus.serverId].title),
                    );
                    rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warning');
                } else {
                    if (rustplus.generalSettings.leaderCommandOnlyForPaired) {
                        if (!Object.keys(instance.serverListLite[rustplus.serverId]).includes(player.steamId)) {
                            const str = client.intlGet(rustplus.guildId, 'playerNotPairedWithServer', {
                                name: player.name,
                            });
                            await (client as any).interactionEditReply(
                                interaction,
                                DiscordEmbedsAny.getActionInfoEmbed(1, str, instance.serverList[rustplus.serverId].title),
                            );
                            rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warning');
                            return;
                        }
                    }

                    if (rustplus.team.leaderSteamId === rustplus.playerId) {
                        await rustplus.team.changeLeadership(player.steamId);
                    } else {
                        await rustplus.leaderRustPlusInstance.promoteToLeaderAsync(player.steamId);
                    }

                    const str = client.intlGet(interaction.guildId, 'leaderTransferred', {
                        name: player.name,
                    });
                    await (client as any).interactionEditReply(
                        interaction,
                        DiscordEmbedsAny.getActionInfoEmbed(0, str, instance.serverList[rustplus.serverId].title),
                    );
                    rustplus.log(client.intlGet(interaction.guildId, 'infoCap'), str, 'info');
                }
                return;
            }
        }

        const str = client.intlGet(interaction.guildId, 'couldNotIdentifyMember', { name: member });
        await (client as any).interactionEditReply(
            interaction,
            DiscordEmbedsAny.getActionInfoEmbed(1, str, instance.serverList[rustplus.serverId].title),
        );
        rustplus.log(client.intlGet(interaction.guildId, 'warningCap'), str, 'warning');
    },
};