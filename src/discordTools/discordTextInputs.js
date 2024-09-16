const Discord = require('discord.js');

module.exports = {
    getTextInput: function (options = {}) {
        const textInput = new Discord.TextInputBuilder();

        if (options.hasOwnProperty('customId')) textInput.setCustomId(options.customId);
        if (options.hasOwnProperty('label')) textInput.setLabel(options.label.slice(0, 45));
        if (options.hasOwnProperty('value')) textInput.setValue(options.value);
        if (options.hasOwnProperty('style')) textInput.setStyle(options.style);
        if (options.hasOwnProperty('minLength')) textInput.setMinLength(options.minLength);
        if (options.hasOwnProperty('maxLength')) textInput.setMaxLength(options.maxLength);
        if (options.hasOwnProperty('placeholder')) textInput.setPlaceholder(options.placeholder);
        if (options.hasOwnProperty('required')) textInput.setRequired(options.required);

        return textInput;
    },
};
