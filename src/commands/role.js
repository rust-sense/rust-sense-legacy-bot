const Builder = require('@discordjs/builders');

const DiscordEmbeds = require('../discordTools/discordEmbeds');
const DiscordTools = require('../discordTools/discordTools');
const PermissionHandler = require('../handlers/permissionHandler.js');

module.exports = {
    name: 'role',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
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

    async execute(client, interaction) {
        const instance = client.getInstance(interaction.guildId);

        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;

        if (!client.isAdministrator(interaction)) {
            const str = client.intlGet(interaction.guildId, 'missingPermission');
            client.interactionReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
            client.log(client.intlGet(null, 'warningCap'), str);
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        const subcommandGroup = interaction.options.getSubcommandGroup(),
            subcommand = interaction.options.getSubcommand();

        async function postRoleChangeHook() {
            const guild = DiscordTools.getGuild(interaction.guildId);
            if (guild) {
                const category = await require('../discordTools/SetupGuildCategory')(client, guild);
                await require('../discordTools/SetupGuildChannels')(client, guild, category);
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
                client.log(client.intlGet(null, 'infoCap'), str);
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
                client.log(client.intlGet(null, 'infoCap'), str);
            }
        }

        client.log(
            client.intlGet(null, 'infoCap'),
            client.intlGet(null, 'slashCommandValueChange', {
                id: `${verifyId}`,
                value: `${interaction.options.getSubcommandGroup()} ${interaction.options.getSubcommand()}`,
            }),
        );
    },
};
