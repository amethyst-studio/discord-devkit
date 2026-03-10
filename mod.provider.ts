import type { GatewayIntentBits, Partials } from 'discord.js';
import type { BaseService } from './lib/base/BaseService.ts';
import { DiscordService } from './lib/service/discord/DiscordService.ts';
import { LedgerService } from './lib/service/LedgerService.ts';
import { TaskService } from './lib/service/TaskService.ts';

export interface NativeServiceProviderOptions {
  ledger: LedgerNativeServiceOptions;
  discord: DiscordNativeServiceOptions;
}

export interface LedgerNativeServiceOptions {
  nativeId: string;
  discordAccentMessage: string;
  webhookId: string;
  webhookToken: string;
  threadId?: string;
}

export interface DiscordNativeServiceOptions {
  token: string;
  intents: [GatewayIntentBits];
  partials: Partials[];
}

type ServiceClass<TService extends BaseService = BaseService> = {
  prototype: TService;
  name: string;
};

/**
 * Internal Public Services Provider.
 */
export class NativeServiceProvider {
  private static options?: NativeServiceProviderOptions;
  private static readonly providers = new Map<ServiceClass, BaseService>();
  private static configurePromise?: Promise<void>;

  public static async configure(options: NativeServiceProviderOptions): Promise<void> {
    if (this.configurePromise) {
      if (JSON.stringify(this.options) !== JSON.stringify(options)) {
        throw new Error('NativeServiceProvider is already configured with different options.');
      }
      await this.configurePromise;
      return;
    }

    this.configurePromise = (async () => {
      if (!this.options) {
        this.options = options;
      }

      // Keep a single immutable global config once initialized.
      if (JSON.stringify(this.options) !== JSON.stringify(options)) {
        throw new Error('NativeServiceProvider is already configured with different options.');
      }

      if (!this.hasProvider(LedgerService)) {
        this.setProvider(LedgerService, await LedgerService.get(this.options.ledger));
      }

      if (!this.hasProvider(DiscordService)) {
        this.setProvider(DiscordService, await DiscordService.get(this.options.discord));
      }

      if (!this.hasProvider(TaskService)) {
        this.setProvider(TaskService, await TaskService.get());
      }
    })();

    await this.configurePromise;
  }

  public static setProvider<TService extends BaseService>(serviceClass: ServiceClass<TService>, provider: TService): TService {
    if (this.providers.has(serviceClass)) {
      throw new Error(`Provider "${serviceClass.name}" is already registered.`);
    }
    this.providers.set(serviceClass, provider);
    return provider;
  }

  public static getProvider<TService extends BaseService>(serviceClass: ServiceClass<TService>): TService {
    const provider = this.providers.get(serviceClass);
    if (!provider) {
      throw new Error(`Provider "${serviceClass.name}" is not registered.`);
    }
    return provider as TService;
  }

  public static hasProvider(serviceClass: ServiceClass): boolean {
    return this.providers.has(serviceClass);
  }

  public static getLedgerService(): LedgerService {
    return this.getProvider(LedgerService);
  }

  public static getDiscordService(): DiscordService {
    return this.getProvider(DiscordService);
  }

  public static getTaskService(): TaskService {
    return this.getProvider(TaskService);
  }
}
