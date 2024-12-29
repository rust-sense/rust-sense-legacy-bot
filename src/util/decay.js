module.exports = {
    TwigWallMaxHp: 10,
    WoodWallMaxHp: 250,
    StoneWallMaxHp: 500,
    MetalWallMaxHp: 1000,
    ArmoredWallMaxHp: 2000,

    TwigWallDecayTimeSeconds: 1 * 60 * 60,
    WoodWallDecayTimeSeconds: 3 * 60 * 60,
    StoneWallDecayTimeSeconds: 5 * 60 * 60,
    MetalWallDecayTimeSeconds: 8 * 60 * 60,
    ArmoredWallDecayTimeSeconds: 12 * 60 * 60,

    getTimeLeftSeconds: function (client, type, hp) {
        if (Number.isNaN(hp)) return null;

        switch (type.toLowerCase()) {
            case client.intlGet('en', 'commandSyntaxTwig'): {
                if (hp < 0 || hp > this.TwigWallMaxHp) return null;
                return Math.floor(this.TwigWallDecayTimeSeconds * (hp / this.TwigWallMaxHp));
            }

            case client.intlGet('en', 'commandSyntaxWood'): {
                if (hp < 0 || hp > this.WoodWallMaxHp) return null;
                return Math.floor(this.WoodWallDecayTimeSeconds * (hp / this.WoodWallMaxHp));
            }

            case client.intlGet('en', 'commandSyntaxStone'): {
                if (hp < 0 || hp > this.StoneWallMaxHp) return null;
                return Math.floor(this.StoneWallDecayTimeSeconds * (hp / this.StoneWallMaxHp));
            }

            case client.intlGet('en', 'commandSyntaxMetal'): {
                if (hp < 0 || hp > this.MetalWallMaxHp) return null;
                return Math.floor(this.MetalWallDecayTimeSeconds * (hp / this.MetalWallMaxHp));
            }

            case client.intlGet('en', 'commandSyntaxArmored'): {
                if (hp < 0 || hp > this.ArmoredWallMaxHp) return null;
                return Math.floor(this.ArmoredWallDecayTimeSeconds * (hp / this.ArmoredWallMaxHp));
            }

            default: {
                return undefined;
            }
        }
    },
};
