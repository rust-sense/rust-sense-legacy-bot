declare module 'translate' {
    interface TranslateOptions {
        from?: string;
        to?: string;
        engine?: string;
        key?: string;
    }

    function translate(text: string, options?: TranslateOptions | string): Promise<string>;

    export default translate;
}
