import { NativeServiceProvider, type NativeServiceProviderOptions } from './mod.provider.ts';

export class DiscordDevkit {
  private provider: NativeServiceProvider;

  public constructor(options: NativeServiceProviderOptions) {
    this.provider = new NativeServiceProvider(options);
  }
}
