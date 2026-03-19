import * as dismoji from 'discord-emoji';

/** Utilize Discord Emoji to validate Emoji Characters. */
export class Emote {
  private static index = new Set<string>([
    ...Object.values(dismoji.activity),
    ...Object.values(dismoji.flags),
    ...Object.values(dismoji.food),
    ...Object.values(dismoji.nature),
    ...Object.values(dismoji.objects),
    ...Object.values(dismoji.people),
    ...Object.values(dismoji.symbols),
    ...Object.values(dismoji.travel),
  ]);

  /**
   * Check an Emoji.
   *
   * @param value The stringified representation of the Emoji literal.
   * @returns If the Emoji is valid.
   */
  public static valid(value: string): boolean {
    return this.index.has(value) || /^<a?:\w{2,32}:\d{17,19}>$/.test(value);
  }

  /**
   * Check a List of Emoji(s).
   *
   * @param values A list of stringified representations(s) of Emoji literals.
   * @returns If the Emoji List is valid.
   */
  public static allValid(values: string[]): boolean {
    for (const value of values) {
      if (!this.valid(value)) {
        return false;
      }
    }
    return true;
  }
}
