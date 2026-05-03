import * as Constants from './constants.js';

export const TwigWallMaxHp = 10;
export const WoodWallMaxHp = 250;
export const StoneWallMaxHp = 500;
export const MetalWallMaxHp = 1000;
export const ArmoredWallMaxHp = 2000;

export const TwigWallDecayTimeSeconds = 1 * 60 * 60;
export const WoodWallDecayTimeSeconds = 3 * 60 * 60;
export const StoneWallDecayTimeSeconds = 5 * 60 * 60;
export const MetalWallDecayTimeSeconds = 8 * 60 * 60;
export const ArmoredWallDecayTimeSeconds = 12 * 60 * 60;

export function getTimeLeftSeconds(
    client: { intlGet: (locale: string, key: string) => string },
    type: string,
    hp: number,
): number | null | undefined {
    if (Number.isNaN(hp)) return null;

    switch (type.toLowerCase()) {
        case client.intlGet('en', 'commandSyntaxTwig'): {
            if (hp < 0 || hp > TwigWallMaxHp) return null;
            return Math.floor(TwigWallDecayTimeSeconds * (hp / TwigWallMaxHp));
        }

        case client.intlGet('en', 'commandSyntaxWood'): {
            if (hp < 0 || hp > WoodWallMaxHp) return null;
            return Math.floor(WoodWallDecayTimeSeconds * (hp / WoodWallMaxHp));
        }

        case client.intlGet('en', 'commandSyntaxStone'): {
            if (hp < 0 || hp > StoneWallMaxHp) return null;
            return Math.floor(StoneWallDecayTimeSeconds * (hp / StoneWallMaxHp));
        }

        case client.intlGet('en', 'commandSyntaxMetal'): {
            if (hp < 0 || hp > MetalWallMaxHp) return null;
            return Math.floor(MetalWallDecayTimeSeconds * (hp / MetalWallMaxHp));
        }

        case client.intlGet('en', 'commandSyntaxArmored'): {
            if (hp < 0 || hp > ArmoredWallMaxHp) return null;
            return Math.floor(ArmoredWallDecayTimeSeconds * (hp / ArmoredWallMaxHp));
        }

        default: {
            return undefined;
        }
    }
}
