import { ulid } from '@std/ulid';
import type { APIApplicationCommandOptionChoice, AutocompleteInteraction, ChatInputCommandInteraction, InteractionEditReplyOptions, InteractionReplyOptions, InteractionUpdateOptions, MessageComponentInteraction, ModalSubmitInteraction, PermissionResolvable } from 'discord.js';
import { NativeServiceProvider } from '../../mod.provider.ts';
import { Async } from '../util/Async.ts';
import { ResponseBuilder } from '../util/baked/ResponseBuilder.ts';

/**
 * BaseChatInputCommand is an abstract class that defines the structure and behavior of chat input commands for a Discord bot. It includes properties for the command's name, options, and a unique reference ID. The class also provides methods for creating and retrieving referable states associated with interactions, allowing for state management across different stages of command execution. Concrete implementations of this class must define
 */
export abstract class BaseChatInputCommand {
  public readonly name: string;
  public readonly options: BaseCommandOptions;
  public readonly reference = ulid();

  private readonly state: Map<string, {
    user: string;
    state: unknown;
  }> = new Map();
  private readonly stateDeleteAt: Map<string, number> = new Map();
  private lastCleanupAt = 0;
  private cleanupJitterMs = 0;

  // deno-lint-ignore require-await
  private async cleanupState(): Promise<void> {
    const now = Date.now();
    const delayMs = 15000 + this.cleanupJitterMs;
    if (now - this.lastCleanupAt < delayMs) {
      return;
    }
    this.lastCleanupAt = now;
    this.cleanupJitterMs = Math.floor(Math.random() * 5000) - 2500;
    for (const [key, value] of this.stateDeleteAt.entries()) {
      if (Date.now() >= value) {
        this.stateDeleteAt.delete(key);
        this.state.delete(key);
      }
    }
  }

  /**
   * Construct a new BaseChatInputCommand with the specified name and options. The constructor initializes the command's name, options, and generates a unique reference ID for the command. The options parameter allows for configuring various aspects of the command, such as whether it is guild-specific, developer-only, and its required permissions. By creating an instance of a subclass of BaseChatInputCommand, developers can define specific behavior for chat input commands while leveraging the built-in state management and referencing capabilities provided by this base class.
   *
   * @param name - The name of the command, which is used to identify and invoke the command within Discord. This name should be unique among all commands registered by the bot to avoid conflicts.
   * @param options - An object containing configuration options for the command, including whether it is guild-specific, developer-only, and its required permissions. These options allow for fine-tuning the command's behavior and access control within the Discord environment.
   */
  public constructor(name: string, options: BaseCommandOptions) {
    this.name = name;
    this.options = options;
  }

  /**
   * Create a referable state that can be retrieved later via its unique ID.
   *
   * @param detail A short detail string to identify the referable state, up to 48 characters.
   * @param state The state to be stored.
   * @param interaction The interaction context associated with this state.
   * @returns A unique ID representing the referable state.
   */
  public referable<T>(detail: string, state: T, interaction: ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction): string {
    void this.cleanupState().catch(() => {
      return;
    });
    if (detail.length > 48) {
      throw new Deno.errors.InvalidData('Referable Detail Exceeds 48 Characters.');
    }
    const id = `${this.reference};${ulid()};${detail}`;
    if (id.length > 100) {
      throw new Deno.errors.InvalidData('Referable Unique ID Exceeds 100 Characters of Custom ID.');
    }
    this.state.set(id, {
      user: interaction.user.id,
      state,
    });
    this.stateDeleteAt.set(id, Date.now() + (1000 * 60 * 60));
    return id;
  }

  /**
   * Retrieve a referable state by its unique ID.
   *
   * @param id The unique ID of the referable state.
   * @param interaction The interaction context to validate user ownership, null if no validation is needed.
   * @returns The stored state of type T.
   */
  public async getReferable<T>(interaction: MessageComponentInteraction | ModalSubmitInteraction, required: boolean = true): Promise<T & { _ref: string } | null> {
    void this.cleanupState().catch(() => {
      return;
    });

    const record = this.state.get(interaction?.customId ?? '');
    if (!record && required) {
      await Async.awaitable(
        this.respond(
          interaction,
          ResponseBuilder.basic({
            title: 'Referable State Not Found',
            message: 'The state could not be found or has expired. Please try again. If this issue persists, please report an issue.',
            footer: {
              format: [
                '{{BRAND}} [{{STUB}}]({{LINK}})',
                '{{TIMESTAMP}}',
              ],
            },
          }),
        ),
      );
      throw new Deno.errors.NotFound('State was not found.');
    }
    if (record !== undefined && interaction.user.id !== record?.user) {
      const awaitResponse = await Async.awaitable(
        this.respond(
          interaction,
          ResponseBuilder.basic({
            title: 'Permission Denied',
            message: 'You do not have permission to access this state. If you believe this is an error, please report an issue.',
            footer: {
              format: [
                '{{BRAND}} [{{STUB}}]({{LINK}})',
                '{{TIMESTAMP}}',
              ],
            },
          }),
        ),
      );
      if (Async.isAwaitableException(awaitResponse)) {
        await this.internal(interaction, awaitResponse.err);
      }
      throw new Deno.errors.PermissionDenied('State does not match associated user.');
    }
    if (record === undefined) {
      return null;
    }
    (record.state as { _ref: string })['_ref'] = interaction.customId.split(';')[2];
    this.state.delete(interaction.customId);
    this.stateDeleteAt.delete(interaction.customId);
    return (record?.state ?? null) as T & { _ref: string } | null;
  }

  public async internal(interaction: ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction, cause: Error): Promise<void> {
    const sendInternalException = await Async.awaitable(
      this.respond(
        interaction,
        await ResponseBuilder.internal({
          message: 'Please try again later. If this issue persists, please report an issue.',
          cause,
        }),
      ),
    );
    if (Async.isAwaitableException(sendInternalException)) {
      (await NativeServiceProvider.getLedgerService()).getLedger().severe('Failed to Send Internal Exception Response', {
        event: 'BaseChatInputCommand.internalException',
        origin: cause,
        cause: sendInternalException.err,
      });
    }
  }

  /**
   * Sends or edits a reply to a Discord interaction, depending on its state.
   *
   * @param interaction - The interaction to respond to (chat, component, or modal).
   * @param options - The reply or edit options.
   */
  public async respond(
    interaction:
      | ChatInputCommandInteraction
      | MessageComponentInteraction
      | ModalSubmitInteraction,
    options: InteractionReplyOptions | InteractionEditReplyOptions | InteractionUpdateOptions,
    forceUpdateReply = false,
  ): Promise<void> {
    await ResponseBuilder.respond(interaction, options, forceUpdateReply);
  }

  public abstract execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface ComponentHandler {
  component(interaction: MessageComponentInteraction): Promise<void>;
}

export interface ModalHandler {
  modal(interaction: ModalSubmitInteraction): Promise<void>;
}

export interface AutoCompleteResponse {
  results: APIApplicationCommandOptionChoice[];
  perPage?: number;
  allowEmptySearch?: boolean;
}

export interface AutoCompleteHandler {
  autocomplete(interaction: AutocompleteInteraction): Promise<AutoCompleteResponse>;
}

export function isComponentHandler(command: BaseChatInputCommand): command is BaseChatInputCommand & ComponentHandler {
  // deno-lint-ignore no-explicit-any
  return 'component' in command && typeof (command as any).component === 'function';
}

export function isModalHandler(command: BaseChatInputCommand): command is BaseChatInputCommand & ModalHandler {
  // deno-lint-ignore no-explicit-any
  return 'modal' in command && typeof (command as any).modal === 'function';
}

export function isAutoCompleteHandler(command: BaseChatInputCommand): command is BaseChatInputCommand & AutoCompleteHandler {
  // deno-lint-ignore no-explicit-any
  return 'autocomplete' in command && typeof (command as any).autocomplete === 'function';
}

interface BaseCommandOptions {
  /** If the command should be registered in guild-context only. */
  guild: boolean;

  /** Indicates if the command is restricted to developers only. */
  developer?: boolean;

  /** Permissions */
  botPermissions?: PermissionResolvable;
  botChannelPermissions?: PermissionResolvable;
  userPermissions?: PermissionResolvable;
  userChannelPermissions?: PermissionResolvable;
}
