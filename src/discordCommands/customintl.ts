import Builder from '@discordjs/builders';
// @ts-expect-error TS(2307) FIXME: Cannot find module '../../config/index.js' or its ... Remove this comment to see the full error message
import DiscordEmbeds from '../discordTools/discordEmbeds.js';
import Constants from '../util/constants.js';

export default {
    name: 'customintl',

    getData(client, guildId) {
        return new Builder.SlashCommandBuilder()
            .setName('customintl')
            .setDescription(client.intlGet(guildId, 'commandsCustomIntlDesc'))
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('set')
                    .setDescription(client.intlGet(guildId, 'commandsCustomIntlSetDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('key')
                            .setDescription(client.intlGet(guildId, 'commandsCustomIntlSetKeyDesc'))
                            .setRequired(true),
                    )
                    .addStringOption((option) =>
                        option
                            .setName('text')
                            .setDescription(client.intlGet(guildId, 'commandsCustomIntlSetTextDesc'))
                            .setRequired(true),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand
                    .setName('reset')
                    .setDescription(client.intlGet(guildId, 'commandsCustomIntlResetDesc'))
                    .addStringOption((option) =>
                        option
                            .setName('key')
                            .setDescription(client.intlGet(guildId, 'commandsCustomIntlResetKeyDesc'))
                            .setRequired(true),
                    ),
            )
            .addSubcommand((subcommand) =>
                subcommand.setName('show').setDescription(client.intlGet(guildId, 'commandsCustomIntlShowDesc')),
            );
    },

    async execute(client, interaction) {
        const verifyId = Math.floor(100000 + Math.random() * 900000);
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ ephemeral: true });

        switch (interaction.options.getSubcommand()) {
            case 'set':
                setCustomIntl(client, interaction, verifyId);
                break;

            case 'reset':
                resetCustomIntl(client, interaction, verifyId);
                break;

            case 'show':
                // @ts-expect-error TS(2554) FIXME: Expected 2 arguments, but got 3.
                showCustomIntl(client, interaction, verifyId);
                break;

            default:
                break;
        }
    },
};

async function setCustomIntl(client, interaction, verifyId) {
    const guildId = interaction.guildId;

    if (!client.isAdministrator(interaction)) {
        const str = client.intlGet(interaction.guildId, 'missingPermission');
        client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(null, 'warningCap'), str);
        return;
    }

    const messageKey = interaction.options.getString('key');
    const messageText = interaction.options.getString('text');

    const guildInstance = client.getInstance(guildId);

    const defaultIntl = client.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);
    if (!(messageKey in defaultIntl.messages)) {
        const str = client.intlGet(guildId, 'customIntlSetKeyDoesNotExist', {
            key: messageKey,
        });
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(guildId, 'warningCap'), str);
        return;
    }

    guildInstance.customIntlMessages[messageKey] = messageText;
    client.loadGuildCustomIntl(guildId, guildInstance, messageKey, messageText);
    client.setInstance(guildId, guildInstance);

    const str = client.intlGet(interaction.guildId, 'customIntlSetSuccess', {
        key: messageKey,
    });
    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
    client.log(client.intlGet(null, 'infoCap'), str);
}

async function resetCustomIntl(client, interaction, verifyId) {
    const guildId = interaction.guildId;

    if (!client.isAdministrator(interaction)) {
        const str = client.intlGet(interaction.guildId, 'missingPermission');
        client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(null, 'warningCap'), str);
        return;
    }

    const messageKey = interaction.options.getString('key');

    const guildInstance = client.getInstance(guildId);

    if (!(messageKey in guildInstance.customIntlMessages)) {
        const str = client.intlGet(guildId, 'customIntlResetKeyNotCustomized', {
            key: messageKey,
        });
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(guildId, 'warningCap'), str);
        return;
    }

    delete guildInstance.customIntlMessages[messageKey];
    delete client.customGuildIntl[guildId][messageKey];
    client.setInstance(guildId, guildInstance);

    const str = client.intlGet(interaction.guildId, 'customIntlResetSuccess', {
        key: messageKey,
    });
    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
    client.log(client.intlGet(null, 'infoCap'), str);
}

async function showCustomIntl(client, interaction) {
    const guildId = interaction.guildId;

    const guildInstance = client.getInstance(guildId);

    const title = client.intlGet(guildId, 'customIntlTitle');
    const keyFieldName = client.intlGet(guildId, 'customIntlKey');
    const messageFieldName = client.intlGet(guildId, 'customIntlMessage');

    let totalCharacters = title.length + keyFieldName.length + messageFieldName.length;
    let fieldIndex = 0;

    const keyStrings = [''],
        messageStrings = [''];
    let keyStringsCharacters = 0,
        messageStringsCharacters = 0;

    for (const [key, message] of Object.entries(guildInstance.customIntlMessages)) {
        const keyString = `${key}\n`;
        const messageString = `${message}\n`;

        if (totalCharacters + (keyString.length + messageString.length) >= Constants.EMBED_MAX_TOTAL_CHARACTERS) {
            break;
        }

        if (
            keyStringsCharacters + keyString.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS ||
            messageStringsCharacters + messageString.length > Constants.EMBED_MAX_FIELD_VALUE_CHARACTERS
        ) {
            fieldIndex += 1;

            keyStrings.push('');
            messageStrings.push('');

            keyStringsCharacters = 0;
            messageStringsCharacters = 0;
        }

        keyStringsCharacters += keyString.length;
        messageStringsCharacters += messageString.length;

        totalCharacters += keyString.length + messageString.length;

        keyStrings[fieldIndex] += keyString;
        messageStrings[fieldIndex] += messageString;
    }

    const fields = [];
    for (let i = 0; i < fieldIndex + 1; i++) {
        fields.push({
            // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
            name: i === 0 ? keyFieldName : '\u200B',
            // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
            value: keyStrings[i] !== '' ? keyStrings[i] : client.intlGet(guildId, 'empty'),
            // @ts-expect-error TS(2322) FIXME: Type 'boolean' is not assignable to type 'never'.
            inline: true,
        });
        fields.push({
            // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
            name: i === 0 ? messageFieldName : '\u200B',
            // @ts-expect-error TS(2322) FIXME: Type 'any' is not assignable to type 'never'.
            value: messageStrings[i] !== '' ? messageStrings[i] : client.intlGet(guildId, 'empty'),
            // @ts-expect-error TS(2322) FIXME: Type 'boolean' is not assignable to type 'never'.
            inline: true,
        });
    }

    const embed = DiscordEmbeds.getEmbed({
        title: title,
        color: Constants.COLOR_DEFAULT,
        fields: fields,
        timestamp: true,
    });

    await client.interactionEditReply(interaction, { embeds: [embed] });
    client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsCustomIntlShowDesc'));
}
