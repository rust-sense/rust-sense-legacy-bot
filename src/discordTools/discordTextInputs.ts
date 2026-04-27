const Discord = require('discord.js');

module.exports = {
    getTextInput: function (options = {}) {
        const textInput = new Discord.TextInputBuilder();

        if (Object.hasOwn(options, 'customId')) textInput.setCustomId(options.customId);
        if (Object.hasOwn(options, 'label')) textInput.setLabel(options.label.slice(0, 45));
        if (Object.hasOwn(options, 'value')) textInput.setValue(options.value);
        if (Object.hasOwn(options, 'style')) textInput.setStyle(options.style);
        if (Object.hasOwn(options, 'minLength')) textInput.setMinLength(options.minLength);
        if (Object.hasOwn(options, 'maxLength')) textInput.setMaxLength(options.maxLength);
        if (Object.hasOwn(options, 'placeholder')) textInput.setPlaceholder(options.placeholder);
        if (Object.hasOwn(options, 'required')) textInput.setRequired(options.required);

        return textInput;
    },
};
