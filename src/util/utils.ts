import fs from 'node:fs';
import path from 'node:path';
import * as Discord from 'discord.js';
import { loadJsonResourceSync } from '../utils/filesystemUtils.js';

const htmlReservedSymbols = loadJsonResourceSync<Record<string, string>>('staticFiles/htmlReservedSymbols.json');

export function generateVerifyId(): number {
    return Math.floor(100000 + Math.random() * 900000);
}

export function isBlacklisted(client: any, instance: any, interaction: any, verifyId: number): boolean {
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

export function getGridSuffix(location: string | null): string {
    return location !== null ? ` (${location})` : '';
}

export function getActiveStr(client: any, guildId: string, active: boolean): string {
    return active ? client.intlGet(guildId, 'onCap') : client.intlGet(guildId, 'offCap');
}

export function orEmpty(client: any, guildId: string, value: string): string {
    return value === '' ? client.intlGet(guildId, 'empty') : value;
}

export async function resolveItemId(
    client: any,
    interaction: any,
    guildId: string,
    itemName: string | null,
    itemId: string | null,
): Promise<string | null> {
    const DiscordEmbeds = await import('../discordTools/discordEmbeds.js') as any;
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

export function parseArgs(str: string): string[] {
    return str.trim().split(/[ ]+/);
}

export function getArgs(str: string, n = 0): string[] {
    const args = parseArgs(str);
    if (isNaN(n)) n = 0;
    if (n < 1) return args;
    const newArgs: string[] = [];

    let remain = str;
    let counter = 1;
    for (const arg of args) {
        if (counter === n) {
            newArgs.push(remain);
            break;
        }
        remain = remain.slice(arg.length).trim();
        newArgs.push(arg);
        counter += 1;
    }

    return newArgs;
}

export function decodeHtml(str: string): string {
    for (const [key, value] of Object.entries(htmlReservedSymbols)) {
        str = str.replace(key, value);
    }

    return str;
}

export function removeInvisibleCharacters(str: string): string {
    str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');
    return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

export function findClosestString(string: string, array: string[], threshold = 2): string | null {
    let minDistance = Infinity;
    let closestString: string | null = null;

    for (let i = 0; i < array.length; i++) {
        const currentString = array[i];
        const distance = levenshteinDistance(string, currentString);

        if (distance < minDistance) {
            minDistance = distance;
            closestString = currentString;
        }

        if (minDistance === 0) break;
    }

    return minDistance > threshold ? null : closestString;
}

/* Function to calculate Levenshtein distance between two strings */
function levenshteinDistance(s1: string, s2: string): number {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();

    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = [];

    for (let i = 0; i <= m; i++) {
        dp[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    return dp[m][n];
}
