import { SlashCommandBuilder } from '@discordjs/builders';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordTools from '../discordTools/discordTools.js';
import * as PermissionHandler from '../handlers/permissionHandler.js';
import type DiscordBot from '../structures/DiscordBot.js';

export default {
    name: 'role',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
            .setName('role')
            .setDescription(client.intlGet(guildId, 'commandsRoleDesc'))
            .addSubcommandGroup((subCmdGroup) =>
                subCmdGroup
                    .setName('regular')
                    .setDescription(client.intlGet(guildId, 'commandsRoleRegularDesc'))
                    .addSubcommand((subCmd) =>
                        subCmd
                            .setName('set')
                            .setDescription(client.intlGet(guildId, 'commandsRoleRegularSetDesc'))
                            .addRoleOption((option) =>
                                option
                                    .setName('role')
                                    .setDescription(client.intlGet(guildId, 'commandsRoleRegularSetRoleDesc'))
                                    .setRequired(true),
                            ),
                    )
                    .addSubcommand((subCmd) =>
                        subCmd.setName('clear').setDescription(client.intlGet(guildId, 'commandsRoleRegularClearDesc')),
                    ),
            )
            .addSubcommandGroup((subCmdGroup) =>
                subCmdGroup
                    .setName('admin')
                    .setDescription(client.intlGet(guildId, 'commandsRoleAdminDesc'))
                    .addSubcommand((subCmd) =>
                        subCmd
                            .setName('set')
                            .setDescription(client.intlGet(guildId, 'commandsRoleAdminSetDesc'))
                            .addRoleOption((option) =>
                                option
                                    .setName('role')
                                    .setDescription(client.intlGet(guildId, 'commandsRoleAdminSetRoleDesc'))
                                    .setRequired(true),
                            ),
                    )
                    .addSubcommand((subCmd) =>
                        subCmd.setName('clear').setDescription(client.intlGet(guildId, 'commandsRoleAdminClearDesc')),
                    ),
            );
    },

    async execute(client: DiscordBot, interaction: any) {
        const instance = client.getInstance(interaction.guildId);

        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;

        if (!client.isAdministrator(interaction)) {
            const str = client.intlGet(interaction.guildId, 'missingPermission');
            client.interactionReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str, 'warn');
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const subcommandGroup = interaction.options.getSubcommandGroup(),
            subcommand = interaction.options.getSubcommand();

        async function postRoleChangeHook() {
            const guild = DiscordTools.getGuild(interaction.guildId);
            if (guild) {
                const SetupGuildCategory = await import('../discordTools/SetupGuildCategory.js');
                const category = await SetupGuildCategory.default(client, guild);
                const SetupGuildChannels = await import('../discordTools/SetupGuildChannels.js');
                await SetupGuildChannels.default(client, guild, category);
                await PermissionHandler.resetPermissionsAllChannels(client, guild);
            }
        }

        if (subcommand === 'set' || subcommand === 'clear') {
            if (subcommand === 'set') {
                const role = interaction.options.getRole('role');

                if (subcommandGroup === 'admin') {
                    instance.adminRole = role.id;
                } else {
                    instance.role = role.id;
                }

                client.setInstance(interaction.guildId, instance);

                await postRoleChangeHook();

                const str = client.intlGet(
                    interaction.guildId,
                    subcommandGroup === 'admin' ? 'commandsRoleAdminSetSuccess' : 'commandsRoleRegularSetSuccess',
                    { name: role.name },
                );
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
                client.log(client.intlGet(null, 'infoCap'), str, 'info');
            } else if (subcommand === 'clear') {
                if (subcommandGroup === 'admin') {
                    instance.adminRole = null;
                } else {
                    instance.role = null;
                }

                client.setInstance(interaction.guildId, instance);

                await postRoleChangeHook();

                const str = client.intlGet(
                    interaction.guildId,
                    subcommandGroup === 'admin' ? 'commandsRoleAdminClearSuccess' : 'commandsRoleRegularClearSuccess',
                );
                await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
                client.log(client.intlGet(null, 'infoCap'), str, 'info');
            }
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${interaction.options.getSubcommandGroup()} ${interaction.options.getSubcommand()}`,
            }),
            'info',
        );
    },
};