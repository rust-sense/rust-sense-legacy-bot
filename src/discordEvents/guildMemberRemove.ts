/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

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

import InstanceUtils from '../util/instanceUtils.js';

export default {
    name: 'guildMemberRemove',
    async execute(client, member) {
        const guildId = member.guild.id;
        const userId = member.user.id;

        const credentials = InstanceUtils.readCredentialsFile(guildId);

        const steamId = Object.keys(credentials).find((e) => credentials[e] && credentials[e].discordUserId === userId);

        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        if (!(steamId in credentials)) return;

        if (steamId === credentials.hoster) {
            if (client.fcmListeners[guildId]) {
                client.fcmListeners[guildId].destroy();
            }
            delete client.fcmListeners[guildId];
            credentials.hoster = null;
        } else {
            // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
            if (client.fcmListenersLite[guildId][steamId]) {
                // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
                client.fcmListenersLite[guildId][steamId].destroy();
            }
            // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
            delete client.fcmListenersLite[guildId][steamId];
        }

        // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
        delete credentials[steamId];
        InstanceUtils.writeCredentialsFile(guildId, credentials);
    },
};
