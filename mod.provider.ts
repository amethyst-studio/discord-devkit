import type { GatewayIntentBits, Partials } from 'discord.js';
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

/**
 * Internal Public Services Provider.
 */
export class NativeServiceProvider {
  private options: NativeServiceProviderOptions;

  public constructor(options: NativeServiceProviderOptions) {
    this.options = options;
  }

  public async getLedgerService(): Promise<LedgerService> {
    return await LedgerService.get(this.options.ledger);
  }

  public async getDiscordService(): Promise<DiscordService> {
    return await DiscordService.get(this.options.discord, this);
  }

  public async getTaskService(): Promise<TaskService> {
    return await TaskService.get(this);
  }
}
