import type { GatewayIntentBits, Partials } from 'discord.js';
import type { BaseService } from './lib/base/BaseService.ts';

// Identity type: uses prototype to avoid construct-signature visibility checks.
type ServiceClass<TService extends BaseService = BaseService> = {
  readonly prototype: TService;
  readonly name: string;
};

// Typed factory used by register() - extends ServiceClass so it's a valid Map key.
type ServiceFactory<TService extends BaseService, TArgs extends unknown[]> = ServiceClass<TService> & {
  get(...args: TArgs): Promise<TService>;
};

export interface NativeServiceProviderOptions {
  ledger: LedgerNativeServiceOptions | null;
  discord: DiscordNativeServiceOptions | null;
  task: true | null;
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

export class NativeServiceProvider {
  private static instance?: NativeServiceProvider;
  private readonly providers = new Map<ServiceClass, BaseService>();

  public static get(): NativeServiceProvider {
    if (!this.instance) {
      this.instance = new NativeServiceProvider();
    }
    return this.instance as NativeServiceProvider;
  }

  public async register<TService extends BaseService, TArgs extends unknown[]>(
    serviceClass: ServiceFactory<TService, TArgs>,
    ...args: TArgs
  ): Promise<TService> {
    if (this.providers.has(serviceClass)) {
      throw new Error(`Provider "${serviceClass.name}" is already registered.`);
    }
    const provider = await serviceClass.get(...args);
    this.providers.set(serviceClass, provider);
    return provider;
  }

  public hasProvider(serviceClass: ServiceClass): boolean {
    return this.providers.has(serviceClass);
  }

  public getProvider<TService extends BaseService>(serviceClass: ServiceClass<TService>): TService {
    const provider = this.providers.get(serviceClass);
    if (!provider) {
      throw new Error(`Provider "${serviceClass.name}" is not registered.`);
    }
    return provider as TService;
  }
}
