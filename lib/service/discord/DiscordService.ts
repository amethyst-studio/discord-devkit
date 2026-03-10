import { Client, Routes } from 'discord.js';
import { type DiscordNativeServiceOptions, NativeServiceProvider } from '../../../mod.provider.ts';
import { BaseService } from '../../base/BaseService.ts';
import { Async } from '../../util/Async.ts';
import { CommandRegistrationService } from './CommandRegistrationService.ts';
import { InternalCommandHandler } from './event/InternalCommandHandler.ts';

const _crs = await CommandRegistrationService.get();

/**
 * Service responsible for managing the Discord client connection and interactions. The DiscordService initializes a Discord client with the necessary intents and partials, sets up event listeners for client readiness, and provides a method to access the client instance for use in other parts of the application. The service also integrates with the LedgerService to log important events such as successful connections and command registrations.
 */
export class DiscordService extends BaseService {
  private options: DiscordNativeServiceOptions;
  public crs: CommandRegistrationService = _crs;

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
  // deno-lint-ignore require-await
  protected override async initialize(): Promise<void> {
    const ledger = NativeServiceProvider.getLedgerService().getLedger();

    InternalCommandHandler.initialize();

    this.client.once(
      'clientReady',
      (session) => {
        const awaitable = Async.awaitable(async () => {
          ledger.information('Client Connected', {
            service: 'DiscordService',
            userId: session.user.id,
            tag: session.user.tag,
          });

          await this.client.rest.put(Routes.applicationCommands(this.client.user!.id), { body: [...this.crs.getAllGlobalBase().map((v) => v.toJSON())] });
          for (const guild of session.guilds.cache.values()) {
            await guild.commands.set([...this.crs.getAllGuildBase().map((v) => v.toJSON())]);
          }
        });

        if (Async.isAwaitableException(awaitable)) {
          ledger.severe('Client Ready Handler Failed', {
            service: 'DiscordService',
            error: awaitable.err,
          });
        }
      },
    );
  }

  /**
   * Get the Discord client instance.
   */
  public getDiscord(): Client {
    return this.client;
  }

  /**
   * Login to the Discord client instance.
   */
  public async login(): Promise<void> {
    await this.client.login(this.options.token);
  }
}
