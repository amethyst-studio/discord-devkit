import { Ledger } from 'ledger';
import type { ConsoleHandlerOptions } from 'ledger/console-handler';
import type { DiscordWebhookOptions } from 'ledger/discord-slack-handler';
import { Level } from 'ledger/struct';
import type { LedgerNativeServiceOptions } from '../../mod.provider.ts';
import { BaseService } from '../base/BaseService.ts';

/**
 * Service responsible for managing the Ledger logging system.
 */
export class LedgerService extends BaseService {
  private options: LedgerNativeServiceOptions;
  private ledger: Ledger;

  /**
   * Initialize the LedgerService with a new Ledger instance configured for the current tenant.
   */
  protected constructor(options: LedgerNativeServiceOptions) {
    super();
    this.options = options;
    this.ledger = new Ledger({
      service: options.nativeId,
      useAsyncDispatchQueue: true,
    });
  }

  /**
   * Get the singleton instance with constructor parameters.
   */
  public static override get(options: LedgerNativeServiceOptions): Promise<LedgerService> {
    return super.get(options) as Promise<LedgerService>;
  }

  /**
   * Initialize the Ledger by registering handlers and ensuring it's alive before the service is ready.
   */
  protected override async initialize(): Promise<void> {
    this.ledger.register<ConsoleHandlerOptions>({
      definition: 'jsr:@ledger/console-handler@0.2.4',
      level: Level.TRACE,
      colors: true,
    });
    this.ledger.register<DiscordWebhookOptions>({
      definition: 'ledger/discord-slack-handler',
      level: Level.SEVERE,
      platform: 'discord',
      discordAccentMessage: this.options.discordAccentMessage,
      id: this.options.webhookId,
      token: this.options.webhookToken,
      threadId: this.options.threadId,
    });
    await this.ledger.alive();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Get the Ledger instance.
   */
  public getLedger(): Ledger {
    return this.ledger;
  }
}
