import { Client, type GatewayIntentBits, type Partials, Routes } from 'discord.js';
import { Async } from '../../baked/Async.ts';
import { BaseService } from '../../provider/base/BaseService.ts';
import { NativeServiceProvider } from '../../provider/provider.ts';
import { LedgerService } from '../LedgerService.ts';
import { BrandingService, type BrandingServiceOptions } from './BrandingService.ts';
import { CommandRegistrationService } from './CommandRegistrationService.ts';
import { InternalCommandHandler } from './event/InternalCommandHandler.ts';

export interface DiscordNativeServiceOptions {
  token: string;
  intents: [GatewayIntentBits];
  partials: Partials[];
  branding?: BrandingServiceOptions;
}

/**
 * Service responsible for managing the Discord client connection and interactions. The DiscordService initializes a Discord client with the necessary intents and partials, sets up event listeners for client readiness, and provides a method to access the client instance for use in other parts of the application. The service also integrates with the LedgerService to log important events such as successful connections and command registrations.
 */
export class DiscordService extends BaseService {
  private options: DiscordNativeServiceOptions;
  private client: Client;

  /**
   * Initialize the DiscordService by creating a new Discord client with the necessary intents and partials.
   */
  protected constructor(options: DiscordNativeServiceOptions) {
    super();
    this.options = options;

    this.client = new Client({
      intents: [
        options.intents,
      ],
      partials: options.partials,
    });
  }

  /**
   * Get the singleton instance with constructor parameters.
   */
  public static override get(options: DiscordNativeServiceOptions): Promise<DiscordService> {
    return super.get(options) as Promise<DiscordService>;
  }

  /**
   * Initialize the DiscordService by setting up event listeners for the Discord client. The primary event listener is for the ClientReady event, which indicates that the client has successfully connected to Discord. When this event is triggered, the service logs the connection details using the LedgerService and registers all guild and global commands using the CommandRegistrationService. This ensures that the bot's commands are available immediately after connecting to Discord.
   */
  protected override async initialize(): Promise<void> {
    // Register Dependent Services.
    await NativeServiceProvider.get().register(CommandRegistrationService);
    await NativeServiceProvider.get().register(BrandingService, this.options.branding ?? {});

    // Get Services
    const ledger = NativeServiceProvider.get().getProvider(LedgerService).instance();
    const crs = NativeServiceProvider.get().getProvider(CommandRegistrationService);

    // Internal Ready Event
    this.client.once(
      'clientReady',
      async (session) => {
        const awaitable = await Async.awaitable(async () => {
          let guildRegistered = 0;
          await this.client.rest.put(Routes.applicationCommands(this.client.user!.id), { body: [...crs.getAllGlobalBase().map((v) => v.toJSON())] });
          for (const guild of session.guilds.cache.values()) {
            const result = await guild.commands.set([...crs.getAllGuildBase().map((v) => v.toJSON())]);
            guildRegistered = result.size;
          }

          ledger.information('Client Connected', {
            service: 'DiscordService',
            userId: session.user.id,
            tag: session.user.tag,
            guildRegistered,
          });
        });

        if (Async.isAwaitableException(awaitable)) {
          ledger.severe('Client Ready Handler Failed', {
            service: 'DiscordService',
            error: awaitable.err,
          });
        }
      },
    );

    await InternalCommandHandler.initialize();
  }

  /**
   * Get the Discord client instance.
   */
  public instance(): Client {
    return this.client;
  }

  /**
   * Login to the Discord client instance.
   */
  public async login(): Promise<void> {
    await this.client.login(this.options.token);
  }
}
