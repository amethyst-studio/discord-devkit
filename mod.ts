import { BrandingService, type BrandingServiceOptions } from './lib/service/BrandingService.ts';
import { DiscordService } from './lib/service/discord/DiscordService.ts';
import { LedgerService } from './lib/service/LedgerService.ts';
import { CronTaskService } from './lib/service/CronTaskService.ts';
import { NativeServiceProvider, type NativeServiceProviderOptions } from './mod.provider.ts';

export class DiscordDevkit {
  public static nsp = NativeServiceProvider.get();

  public static async initialize(options: {
    nativeServiceProviderOptions: NativeServiceProviderOptions;
    nativeBranding?: BrandingServiceOptions;
  }): Promise<void> {
    await this.nsp.register(BrandingService, options.nativeBranding ?? {});
    await this.nsp.register(LedgerService, options.nativeServiceProviderOptions.ledger);
    await this.nsp.register(CronTaskService);

    if (options.nativeServiceProviderOptions.discord !== null) {
      await this.nsp.register(DiscordService, options.nativeServiceProviderOptions.discord);
    }
  }
}

export { BrandingService, BrandingService as DiscordDevkitNativeBranding };
export type { BrandingServiceOptions, BrandingServiceOptions as DiscordDevkitNativeBrandingOptions };
