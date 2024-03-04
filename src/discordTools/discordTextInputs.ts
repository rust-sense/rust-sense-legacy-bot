import Discord from 'discord.js';

export default {
    getTextInput: function (options = {}) {
        const textInput = new Discord.TextInputBuilder();

        if (options.hasOwn('customId')) textInput.setCustomId(options.customId);

        if (options.hasOwn('label')) textInput.setLabel(options.label.slice(0, 45));

        if (options.hasOwn('value')) textInput.setValue(options.value);

        if (options.hasOwn('style')) textInput.setStyle(options.style);

        if (options.hasOwn('minLength')) textInput.setMinLength(options.minLength);

        if (options.hasOwn('maxLength')) textInput.setMaxLength(options.maxLength);

        if (options.hasOwn('placeholder')) textInput.setPlaceholder(options.placeholder);

        if (options.hasOwn('required')) textInput.setRequired(options.required);

        return textInput;
    },
};
