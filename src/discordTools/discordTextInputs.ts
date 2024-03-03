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
