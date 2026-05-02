import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageFlags } from 'discord.js';

import * as DiscordEmbeds from '../discordTools/discordEmbeds.js';
import * as DiscordMessages from '../discordTools/discordMessages.js';
import { getPersistenceCache } from '../persistence/index.js';
import type DiscordBot from '../structures/DiscordBot.js';
import * as Constants from '../util/constants.js';

export default {
    name: 'customintl',

    getData(client: DiscordBot, guildId: string) {
        return new SlashCommandBuilder()
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

    async execute(client: DiscordBot, interaction: any) {
        const verifyId = client.generateVerifyId();
        client.logInteraction(interaction, verifyId, 'slashCommand');

        if (!(await client.validatePermissions(interaction))) return;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        switch (interaction.options.getSubcommand()) {
            case 'set':
                setCustomIntl(client, interaction, verifyId);
                break;

            case 'reset':
                resetCustomIntl(client, interaction, verifyId);
                break;

            case 'show':
                showCustomIntl(client, interaction, verifyId);
                break;

            default:
                break;
        }
    },
};

async function setCustomIntl(client: DiscordBot, interaction: any, verifyId: string) {
    const guildId = interaction.guildId;

    if (!(await client.isAdministrator(interaction))) {
        const str = client.intlGet(interaction.guildId, 'missingPermission');
        client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(null, 'warningCap'), str, 'warn');
        return;
    }

    const messageKey = interaction.options.getString('key');
    const messageText = interaction.options.getString('text');

    const guildInstance = await getPersistenceCache().readGuildState(guildId);

    const defaultIntl = client.checkLocaleIntlLoad(Constants.DEFAULT_LOCALE);
    if (!(messageKey in defaultIntl.messages)) {
        const str = client.intlGet(guildId, 'customIntlSetKeyDoesNotExist', {
            key: messageKey,
        });
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(guildId, 'warningCap'), str, 'warn');
        return;
    }

    guildInstance.customIntlMessages[messageKey] = messageText;
    client.loadGuildCustomIntl(guildId, guildInstance, messageKey, messageText);
    await getPersistenceCache().saveGuildStateChanges(guildId, guildInstance);

    const str = client.intlGet(interaction.guildId, 'customIntlSetSuccess', {
        key: messageKey,
    });
    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
    client.log(client.intlGet(null, 'infoCap'), str, 'info');
}

async function resetCustomIntl(client: DiscordBot, interaction: any, verifyId: string) {
    const guildId = interaction.guildId;

    if (!(await client.isAdministrator(interaction))) {
        const str = client.intlGet(interaction.guildId, 'missingPermission');
        client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(null, 'warningCap'), str, 'warn');
        return;
    }

    const messageKey = interaction.options.getString('key');

    const guildInstance = await getPersistenceCache().readGuildState(guildId);

    if (!(messageKey in guildInstance.customIntlMessages)) {
        const str = client.intlGet(guildId, 'customIntlResetKeyNotCustomized', {
            key: messageKey,
        });
        await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
        client.log(client.intlGet(guildId, 'warningCap'), str, 'warn');
        return;
    }

    delete guildInstance.customIntlMessages[messageKey];
    delete client.customGuildIntl[guildId][messageKey];
    await getPersistenceCache().saveGuildStateChanges(guildId, guildInstance);

    const str = client.intlGet(interaction.guildId, 'customIntlResetSuccess', {
        key: messageKey,
    });
    await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, str));
    client.log(client.intlGet(null, 'infoCap'), str, 'info');
}

async function showCustomIntl(client: DiscordBot, interaction: any, verifyId: string) {
    const guildId = interaction.guildId;

    const guildInstance = await getPersistenceCache().readGuildState(guildId);

    const title = client.intlGet(guildId, 'customIntlTitle');
    const keyFieldName = client.intlGet(guildId, 'customIntlKey');
    const messageFieldName = client.intlGet(guildId, 'customIntlMessage');

    let totalCharacters = title.length + keyFieldName.length + messageFieldName.length;
    let fieldIndex = 0;

    let keyStrings = [''],
        messageStrings = [''];
    let keyStringsCharacters = 0,
        messageStringsCharacters = 0;

    for (const [key, message] of Object.entries(guildInstance.customIntlMessages as Record<string, string>)) {
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
            name: i === 0 ? keyFieldName : '\u200B',
            value: keyStrings[i] !== '' ? keyStrings[i] : client.intlGet(guildId, 'empty'),
            inline: true,
        });
        fields.push({
            name: i === 0 ? messageFieldName : '\u200B',
            value: messageStrings[i] !== '' ? messageStrings[i] : client.intlGet(guildId, 'empty'),
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
    client.log(client.intlGet(null, 'infoCap'), client.intlGet(guildId, 'commandsCustomIntlShowDesc'), 'info');
}
