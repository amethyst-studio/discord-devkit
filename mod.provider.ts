import { GatewayIntentBits, Partials } from 'discord.js';
import { LedgerService } from './lib/service/LedgerService.ts';
import { DiscordService } from './lib/service/discord/DiscordService.ts';

export interface NativeServiceProviderOptions {
  ledger: LedgerNativeServiceOptions;
  kysely: {};
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
 * 
 * You 
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
}
