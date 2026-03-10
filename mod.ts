import { NativeServiceProvider, type NativeServiceProviderOptions } from './mod.provider.ts';

export class DiscordDevkit {
  public static async initialize(options: {
    nativeServiceProviderOptions: NativeServiceProviderOptions;
    nativeBranding: DiscordDevkitNativeBrandingOptions;
  }): Promise<void> {
    // Register Providers
    await NativeServiceProvider.configure(options.nativeServiceProviderOptions);

    // Setup Strong/Depending Helpers
    DiscordDevkitNativeBranding.set(options.nativeBranding);
  }
}

export class DiscordDevkitNativeBranding {
  public static brand: string = 'Official Companion Bot';
  public static stub: string = 'Created by <@100737000973275136>.';
  public static link: string = 'https://github.com/xCykrix';
  public static ref: string = '';

  public static set(io: DiscordDevkitNativeBrandingOptions): void {
    if (io.brand) {
      this.brand = io.brand ?? this.brand;
    }
    if (io.stub) {
      this.stub = io.stub ?? this.stub;
    }
    if (io.link) {
      this.link = io.link ?? this.link;
    }
    if (io.ref) {
      this.ref = io.ref ?? this.ref;
    }
  }
}

export type DiscordDevkitNativeBrandingOptions = {
  brand?: string;
  stub?: string;
  link?: string;
  ref?: string;
};
