interface Dictionary {
  [key: string]: number;
}

class UnBase {
  private readonly radix: number;
  private readonly alpha62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  private readonly alpha95 = ` !"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\`abcdefghijklmnopqrstuvwxyz{|}~`;
  private alphabet = '';
  private dictionary: Dictionary = {};

  constructor(radix: number) {
    this.radix = radix;
    if (radix > 36) {
      if (radix < 62) this.alphabet = this.alpha62.substring(0, radix);
      else if (radix === 62) this.alphabet = this.alpha62;
      else if (radix < 95) this.alphabet = this.alpha95.substring(0, radix);
      else if (radix === 95) this.alphabet = this.alpha95;

      for (let i = 0; i < this.alphabet.length; i++) {
        this.dictionary[this.alphabet.charAt(i)] = i;
      }
    }
  }

  unBase(str: string): number {
    if (this.alphabet === '') return parseInt(str, this.radix);
    let ret = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charAt(str.length - 1 - i);
      const value = this.dictionary[char];
      if (value !== undefined) ret += Math.pow(this.radix, i) * value;
    }
    return ret;
  }
}

export class JSPacker {
  readonly packedJS: string;

  constructor(packedJS: string) {
    this.packedJS = packedJS;
  }

  detect(): boolean {
    return /eval\(function\(p,a,c,k,e,(?:r|d)/.test(this.packedJS.replace(/ /g, ''));
  }

  unpack(): string | null {
    try {
      const exp = /\}\s*\('(.*)',\s*(.*?),\s*(\d+),\s*'(.*?)'\.split\('\|'\)/s;
      const matches = exp.exec(this.packedJS);
      if (!matches || matches.length !== 5) return null;

      let payload = matches[1]!.replace(/\\'/g, "'");
      const radix = parseInt(matches[2]!, 10) || 36;
      const count = parseInt(matches[3]!, 10) || 0;
      const symArray = matches[4]!.split('|');

      if (symArray.length !== count) throw new Error('Unknown p.a.c.k.e.r encoding');

      const unBase = new UnBase(radix);

      payload = payload.replace(/\b\w+\b/g, (word: string): string => {
        const index = unBase.unBase(word);
        if (index < symArray.length && symArray[index]) return symArray[index];
        return word;
      });

      return payload;
    } catch {
      return null;
    }
  }
}

export function unpackJsAndCombine(packedCode: string): string {
  const packer = new JSPacker(packedCode);
  if (packer.detect()) {
    const result = packer.unpack();
    if (result) return result;
  }
  throw new Error('Unable to unpack JS — not a valid p.a.c.k.e.r payload');
}
