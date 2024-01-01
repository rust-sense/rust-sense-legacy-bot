/*
	Copyright (C) 2023 Alexander Emanuelsson (alexemanuelol)

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.

	https://github.com/alexemanuelol/rustplusplus

*/

import Builder from '@discordjs/builders';

import DiscordEmbeds from '../discordTools/discordEmbeds.js';
import Timer from '../util/timer.js';

export default {
	name: 'decay',

	getData(client, guildId) {
		return new Builder.SlashCommandBuilder()
			.setName('decay')
			.setDescription(client.intlGet(guildId, 'commandsDecayDesc'))
			.addStringOption(option => option
				.setName('name')
				.setDescription(client.intlGet(guildId, 'theNameOfTheItem'))
				.setRequired(false))
			.addStringOption(option => option
				.setName('id')
				.setDescription(client.intlGet(guildId, 'theIdOfTheItem'))
				.setRequired(false))
			.addIntegerOption(option => option
				.setName('hp')
				.setDescription(client.intlGet(guildId, 'currentItemHp'))
				.setRequired(false));
	},

	async execute(client, interaction) {
		const guildId = interaction.guildId;

		const verifyId = Math.floor(100000 + Math.random() * 900000);
		client.logInteraction(interaction, verifyId, 'slashCommand');

		if (!(await client.validatePermissions(interaction))) return;
		await interaction.deferReply({ ephemeral: true });

		const decayItemName = interaction.options.getString('name');
		const decayItemId = interaction.options.getString('id');
		const decayItemHp = interaction.options.getInteger('hp');

		let itemId = null;
		let type = 'items';

		if (decayItemName !== null) {
			let foundName = null;
			if (!foundName) {
				foundName = client.rustlabs.getClosestOtherNameByName(decayItemName);
				if (foundName) {
					if (client.rustlabs.decayData['other'].hasOwnProperty(foundName)) {
						type = 'other';
					}
					else {
						foundName = null;
					}
				}
			}

			if (!foundName) {
				foundName = client.rustlabs.getClosestBuildingBlockNameByName(decayItemName);
				if (foundName) {
					if (client.rustlabs.decayData['buildingBlocks'].hasOwnProperty(foundName)) {
						type = 'buildingBlocks';
					}
					else {
						foundName = null;
					}
				}
			}

			if (!foundName) {
				foundName = client.items.getClosestItemIdByName(decayItemName);
				if (foundName) {
					if (!client.rustlabs.decayData['items'].hasOwnProperty(foundName)) {
						foundName = null;
					}
				}
			}

			if (!foundName) {
				const str = client.intlGet(guildId, 'noItemWithNameFound', {
					name: decayItemName
				});
				await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
				client.log(client.intlGet(guildId, 'warningCap'), str);
				return;
			}
			itemId = foundName;
		}
		else if (decayItemId !== null) {
			if (client.items.itemExist(decayItemId)) {
				itemId = decayItemId;
			}
			else {
				const str = client.intlGet(guildId, 'noItemWithIdFound', {
					id: decayItemId
				});
				await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
				client.log(client.intlGet(guildId, 'warningCap'), str);
				return;
			}
		}
		else if (decayItemName === null && decayItemId === null) {
			const str = client.intlGet(guildId, 'noNameIdGiven');
			await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
			client.log(client.intlGet(guildId, 'warningCap'), str);
			return;
		}

		let itemName = null;
		let decayDetails = null;
		if (type === 'items') {
			itemName = client.items.getName(itemId);
			decayDetails = client.rustlabs.getDecayDetailsById(itemId);
		}
		else {
			itemName = itemId;
			decayDetails = client.rustlabs.getDecayDetailsByName(itemId);
		}

		if (decayDetails === null) {
			const str = client.intlGet(guildId, 'couldNotFindDecayDetails', {
				name: itemName
			});
			await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
			client.log(client.intlGet(guildId, 'warningCap'), str);
			return;
		}

		const details = decayDetails[3];

// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
		const hp = decayItemHp === null ? details.hp : decayItemHp;
// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
		if (hp > details.hp) {
			const str = client.intlGet(guildId, 'hpExceedMax', {
				hp: hp,
// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
				max: details.hp
			});
			await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(1, str));
			client.log(client.intlGet(guildId, 'warningCap'), str);
			return;
		}

// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
		const decayMultiplier = hp / details.hp;

// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
		let decayString = `${itemName} (${hp}/${details.hp}) `;
		const decayStrings = [];
// @ts-expect-error TS(2339): Property 'decayString' does not exist on type 'nev... Remove this comment to see the full error message
		if (details.decayString !== null) {
			const str = `${client.intlGet(guildId, 'decay')}: `;
// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
			if (hp === details.hp) {
// @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
				decayStrings.push(`${str}${details.decayString}`);
			}
			else {
// @ts-expect-error TS(2339): Property 'decay' does not exist on type 'never'.
				const time = Timer.secondsToFullScale(Math.floor(details.decay * decayMultiplier));
// @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
				decayStrings.push(`${str}${time}`);
			}
		}

// @ts-expect-error TS(2339): Property 'decayOutsideString' does not exist on ty... Remove this comment to see the full error message
		if (details.decayOutsideString !== null) {
			const str = `${client.intlGet(guildId, 'outside')}: `;
// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
			if (hp === details.hp) {
// @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
				decayStrings.push(`${str}${details.decayOutsideString}`);
			}
			else {
// @ts-expect-error TS(2339): Property 'decayOutside' does not exist on type 'ne... Remove this comment to see the full error message
				const time = Timer.secondsToFullScale(Math.floor(details.decayOutside * decayMultiplier));
// @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
				decayStrings.push(`${str}${time}`);
			}
		}

// @ts-expect-error TS(2339): Property 'decayInsideString' does not exist on typ... Remove this comment to see the full error message
		if (details.decayInsideString !== null) {
			const str = `${client.intlGet(guildId, 'inside')}: `;
// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
			if (hp === details.hp) {
// @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
				decayStrings.push(`${str}${details.decayInsideString}`);
			}
			else {
// @ts-expect-error TS(2339): Property 'decayInside' does not exist on type 'nev... Remove this comment to see the full error message
				const time = Timer.secondsToFullScale(Math.floor(details.decayInside * decayMultiplier));
// @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
				decayStrings.push(`${str}${time}`);
			}
		}

// @ts-expect-error TS(2339): Property 'decayUnderwaterString' does not exist on... Remove this comment to see the full error message
		if (details.decayUnderwaterString !== null) {
			const str = `${client.intlGet(guildId, 'underwater')}: `;
// @ts-expect-error TS(2339): Property 'hp' does not exist on type 'never'.
			if (hp === details.hp) {
// @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
				decayStrings.push(`${str}${details.decayUnderwaterString}`);
			}
			else {
// @ts-expect-error TS(2339): Property 'decayUnderwater' does not exist on type ... Remove this comment to see the full error message
				const time = Timer.secondsToFullScale(Math.floor(details.decayUnderwater * decayMultiplier));
// @ts-expect-error TS(2345): Argument of type 'string' is not assignable to par... Remove this comment to see the full error message
				decayStrings.push(`${str}${time}`);
			}
		}
		decayString += `${decayStrings.join(', ')}.`;

		client.log(client.intlGet(null, 'infoCap'), client.intlGet(null, 'slashCommandValueChange', {
			id: `${verifyId}`,
			value: `${decayItemName} ${decayItemId} ${decayItemHp}`
		}));

		await client.interactionEditReply(interaction, DiscordEmbeds.getActionInfoEmbed(0, decayString));
		client.log(client.intlGet(null, 'infoCap'), decayString);
	},
};
