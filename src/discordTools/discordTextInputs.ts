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

import Discord from 'discord.js';

export default {
    getTextInput: function (options = {}) {
        const textInput = new Discord.TextInputBuilder();

        // @ts-expect-error TS(2339) FIXME: Property 'customId' does not exist on type '{}'.
        if (options.hasOwnProperty('customId')) textInput.setCustomId(options.customId);
        // @ts-expect-error TS(2339) FIXME: Property 'label' does not exist on type '{}'.
        if (options.hasOwnProperty('label')) textInput.setLabel(options.label.slice(0, 45));
        // @ts-expect-error TS(2339) FIXME: Property 'value' does not exist on type '{}'.
        if (options.hasOwnProperty('value')) textInput.setValue(options.value);
        // @ts-expect-error TS(2339) FIXME: Property 'style' does not exist on type '{}'.
        if (options.hasOwnProperty('style')) textInput.setStyle(options.style);
        // @ts-expect-error TS(2339) FIXME: Property 'minLength' does not exist on type '{}'.
        if (options.hasOwnProperty('minLength')) textInput.setMinLength(options.minLength);
        // @ts-expect-error TS(2339) FIXME: Property 'maxLength' does not exist on type '{}'.
        if (options.hasOwnProperty('maxLength')) textInput.setMaxLength(options.maxLength);
        // @ts-expect-error TS(2339) FIXME: Property 'placeholder' does not exist on type '{}'... Remove this comment to see the full error message
        if (options.hasOwnProperty('placeholder')) textInput.setPlaceholder(options.placeholder);
        // @ts-expect-error TS(2339) FIXME: Property 'required' does not exist on type '{}'.
        if (options.hasOwnProperty('required')) textInput.setRequired(options.required);

        return textInput;
    },
};
