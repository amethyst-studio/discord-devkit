import type { ChatInputCommandBuilder, ChatInputCommandSubcommandGroupBuilder } from 'discord.js/builders';
import type { BaseChatInputCommand } from '../../base/BaseCommand.ts';
import { BaseService } from '../../base/BaseService.ts';

/**
 * Service responsible for defining and registering Discord commands related to message management.
 */
export class CommandRegistrationService extends BaseService {
  private registeredByGuild: Map<string, BaseChatInputCommand> = new Map();
  private registeredByReference: Map<string, BaseChatInputCommand> = new Map();
  private global: Set<ChatInputCommandBuilder> = new Set();
  private guild: Set<ChatInputCommandBuilder> = new Set();
  private editable: Map<string, ChatInputCommandSubcommandGroupBuilder> = new Map();
  private editableCommands: Map<string, ChatInputCommandBuilder> = new Map();

  /**
   * Initialize the CommandDefinitionService by defining the set of Discord commands.
   */
  protected constructor() {
    super();
  }

  protected override async initialize(): Promise<void> {
  }

  /**
   * Get the singleton instance with constructor parameters.
   */
  public static override get(): Promise<CommandRegistrationService> {
    return super.get() as Promise<CommandRegistrationService>;
  }

  /**
   * Hook a BaseChatInputCommand into the CommandRegistrationService, allowing it to be registered and retrieved by name or reference. This method takes a BaseChatInputCommand instance and stores it in internal maps for easy access during command registration and execution. By hooking commands into the service, they can be automatically registered with Discord when the client is ready, ensuring that all commands are available for use without requiring manual registration in multiple places.
   *
   * @param base - An instance of a BaseChatInputCommand that represents a Discord command to be registered. This command should have a unique name and reference to avoid collisions with other commands in the service. Once hooked, the command can be retrieved by its name or reference for execution when invoked by users in Discord.
   */
  public hook(base: BaseChatInputCommand): void {
    this.registeredByGuild.set(base.name, base);
    this.registeredByReference.set(base.reference, base);
  }

  /**
   * Register a new command with the CommandRegistrationService, specifying whether it should be registered as a guild-specific command or a global command. This method takes a ChatInputCommandBuilder instance and adds it to the appropriate set based on the specified mode. Guild commands are registered for each guild the bot is in, while global commands are registered across all guilds. By using this method, developers can easily manage their command registrations and ensure that their commands are available in Discord according to their intended scope.
   *
   * @param mode - An enum value of type CRSMode that indicates whether the command should be registered as a guild-specific command (CRSMode.GUILD) or a global command (CRSMode.GLOBAL). This determines how the command will be registered with Discord and where it will be available for use by users.
   * @param command - An instance of ChatInputCommandBuilder that defines the structure and behavior of the Discord command to be registered. This builder should include the command's name, description, options, and any other necessary configuration. Once registered, the command will be available for users to invoke in Discord according to the specified mode (guild or global).
   * @returns - The same ChatInputCommandBuilder instance that was passed in, allowing for method chaining or further modifications after registration if needed.
   */
  public register(mode: CRSMode, command: ChatInputCommandBuilder): ChatInputCommandBuilder {
    if (mode === CRSMode.GUILD) {
      this.guild.add(command);
    }
    else {
      this.global.add(command);
    }
    return command;
  }

  /**
   * Store an editable ChatInputCommandSubcommandGroupBuilder in the CommandRegistrationService, allowing it to be retrieved and modified later using a unique path. This method takes a prefix and a builder instance, constructs a unique key by combining the prefix with the builder's name, and stores the builder in an internal map. By using this method, developers can manage subcommand groups that may need to be edited or updated after their initial creation, providing flexibility in command management while ensuring that each editable group can be uniquely identified and accessed when needed.
   *
   * @param prefix - A string that serves as a namespace or category for the editable builder being stored. This prefix is combined with the builder's name to create a unique key for storage in the service's internal map. The prefix helps to organize editable builders and prevent naming collisions by providing context for where the builder is used within the command structure.
   * @param builder - An instance of ChatInputCommandSubcommandGroupBuilder that represents a group of subcommands within a Discord command. This builder should have a unique name that, when combined with the provided prefix, creates a unique key for storage. By storing this builder in the CommandRegistrationService, it can be retrieved and modified later using the getEditable method, allowing for dynamic updates to subcommand groups as needed.
   * @returns - The same ChatInputCommandSubcommandGroupBuilder instance that was passed in, allowing for method chaining or further modifications after storage if needed.
   */
  public storeEditable(prefix: string, builder: ChatInputCommandSubcommandGroupBuilder): ChatInputCommandSubcommandGroupBuilder {
    if (this.editable.has(`${prefix}.${builder['data'].name!}`)) {
      throw new Deno.errors.InvalidData(`CRS Editable Collision: ${prefix}.${builder['data'].name!}`);
    }
    this.editable.set(`${prefix}.${builder['data'].name!}`, builder);
    return builder;
  }

  /**
   * Retrieve an editable ChatInputCommandSubcommandGroupBuilder from the CommandRegistrationService using a unique path. This method takes a string path that corresponds to the key used when storing the builder with the storeEditable method. If a builder exists for the given path, it is returned; otherwise, an error is thrown indicating that the lookup failed. By using this method, developers can access and modify previously stored subcommand group builders, allowing for dynamic updates to command structures as needed while ensuring that each editable group can be uniquely identified and accessed.
   *
   * @param path - A string that represents the unique key for the editable builder being retrieved. This path should match the key used when the builder was stored using the storeEditable method, which typically combines a prefix with the builder's name (e.g., "CommandBuilder.MESSAGE.branded"). If a builder exists for the provided path, it will be returned; otherwise, an error will be thrown indicating that the lookup failed.
   * @returns - An instance of ChatInputCommandSubcommandGroupBuilder that corresponds to the provided path. This builder can be modified as needed after retrieval, allowing for dynamic updates to subcommand groups within the command structure. If no builder exists for the given path, an error will be thrown to indicate that the lookup was unsuccessful.
   */
  public getEditable(path: string): ChatInputCommandSubcommandGroupBuilder {
    if (!this.editable.has(path)) {
      throw new Deno.errors.InvalidData(`Failed CRS Lookup: ${path}`);
    }
    return this.editable.get(path)!;
  }

  /**
   * Store an editable ChatInputCommandBuilder in the CommandRegistrationService.
   *
   * @param path - The unique path for storing the command builder.
   * @param builder - The ChatInputCommandBuilder instance to store.
   * @returns - The same ChatInputCommandBuilder instance.
   */
  public storeEditableCommand(path: string, builder: ChatInputCommandBuilder): ChatInputCommandBuilder {
    if (this.editableCommands.has(path)) {
      throw new Deno.errors.InvalidData(`CRS Editable Command Collision: ${path}`);
    }
    this.editableCommands.set(path, builder);
    return builder;
  }

  /**
   * Retrieve an editable ChatInputCommandBuilder from the CommandRegistrationService.
   *
   * @param path - The unique path of the command builder to retrieve.
   * @returns - The ChatInputCommandBuilder instance.
   */
  public getEditableCommand(path: string): ChatInputCommandBuilder {
    if (!this.editableCommands.has(path)) {
      throw new Deno.errors.InvalidData(`Failed CRS Command Lookup: ${path}`);
    }
    return this.editableCommands.get(path)!;
  }

  /**
   * Retrieve a registered BaseChatInputCommand from the CommandRegistrationService using its name. This method checks if a command with the specified name exists in the registeredByGuild map and returns it if found. If no command is found with the given name, the method returns null. By using this method, developers can access registered commands by their unique names, allowing for execution or further manipulation as needed within the application.
   *
   * @param name - A string that represents the unique name of the registered command to be retrieved. This name should correspond to the name of a BaseChatInputCommand that has been hooked into the CommandRegistrationService using the hook method. If a command with the specified name exists, it will be returned; otherwise, the method will return null to indicate that no such command is registered.
   * @returns - An instance of BaseChatInputCommand that corresponds to the provided name if it exists in the registeredByGuild map; otherwise, null. This allows developers to access and execute registered commands by their unique names within the application.
   */
  public getRegistered(name: string): BaseChatInputCommand | null {
    if (!this.registeredByGuild.has(name)) {
      return null;
    }
    return this.registeredByGuild.get(name)!;
  }

  /**
   * Retrieve a registered BaseChatInputCommand from the CommandRegistrationService using its reference. This method checks if a command with the specified reference exists in the registeredByReference map and returns it if found. If no command is found with the given reference, the method returns null. By using this method, developers can access registered commands by their unique references, allowing for execution or further manipulation as needed within the application.
   *
   * @param ref - A string that represents the unique reference of the registered command to be retrieved. This reference should correspond to the reference of a BaseChatInputCommand that has been hooked into the CommandRegistrationService using the hook method. If a command with the specified reference exists, it will be returned; otherwise, the method will return null to indicate that no such command is registered.
   * @returns - An instance of BaseChatInputCommand that corresponds to the provided reference if it exists in the registeredByReference map; otherwise, null. This allows developers to access and execute registered commands by their unique references within the application.
   */
  public getRegisteredByReference(ref: string): BaseChatInputCommand | null {
    if (!this.registeredByReference.has(ref.split(';')[0])) {
      return null;
    }
    return this.registeredByReference.get(ref.split(';')[0])!;
  }

  /**
   * Get all registered guild ChatInputCommandBuilder instances.
   *
   * @returns - An array of ChatInputCommandBuilder instances that are registered as guild commands.
   */
  public getAllGuildBase(): ChatInputCommandBuilder[] {
    return Array.from(this.guild);
  }

  /**
   * Get all registered global ChatInputCommandBuilder instances.
   *
   * @return - An array of ChatInputCommandBuilder instances that are registered as global commands.
   */
  public getAllGlobalBase(): ChatInputCommandBuilder[] {
    return Array.from(this.global);
  }
}

/**
 * The command registration modes for Discord commands, indicating whether a command should be registered as a guild-specific command or a global command.
 */
export enum CRSMode {
  GUILD,
  GLOBAL,
}
