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

  public static configure(options: NativeServiceProviderOptions): void {
    if (!this.options) {
      this.options = options;
      return;
    }

    // Keep a single immutable global config once initialized.
    if (JSON.stringify(this.options) !== JSON.stringify(options)) {
      throw new Error('NativeServiceProvider is already configured with different options.');
    }
  }

  private static getOptions(): NativeServiceProviderOptions {
    if (!this.options) {
      throw new Error('NativeServiceProvider is not configured.');
    }
    return this.options;
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

  public static async getLedgerService(): Promise<LedgerService> {
    const options = this.getOptions();
    if (!this.hasProvider(LedgerService)) {
      const provider = await LedgerService.get(options.ledger);
      this.setProvider(LedgerService, provider);
    }
    return this.getProvider(LedgerService);
  }

  public static async getDiscordService(): Promise<DiscordService> {
    const options = this.getOptions();
    if (!this.hasProvider(DiscordService)) {
      const service = await DiscordService.get(options.discord);
      this.setProvider(DiscordService, service);
    }
    return this.getProvider(DiscordService);
  }

  public static async getTaskService(): Promise<TaskService> {
    if (!this.hasProvider(TaskService)) {
      const service = await TaskService.get();
      this.setProvider(TaskService, service);
    }
    return this.getProvider(TaskService);
  }
}
