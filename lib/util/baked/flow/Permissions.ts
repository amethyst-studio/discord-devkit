import type { ChatInputCommandInteraction, GuildTextBasedChannel, ModalSubmitInteraction, PermissionResolvable } from 'discord.js';
import { ResponseBuilder } from './ResponseBuilder.ts';
import { Async } from '../../Async.ts';

/**
 * Checks if the user and bot have the required permissions to perform an action, and optionally responds with a message if they do not.
 *
 * @param options - An object containing the interaction, required permissions for the user and bot, and an optional channel and respond flag.
 * @returns - A boolean indicating whether all required permissions are met.
 */
export async function hasRequiredPermissions(options: {
  interaction: ChatInputCommandInteraction | ModalSubmitInteraction;
  userGuildPermissions: PermissionResolvable;
  userChannelPermissions: PermissionResolvable;
  botGuildPermissions: PermissionResolvable;
  botChannelPermissions: PermissionResolvable;
  channel?: GuildTextBasedChannel;
  respond?: boolean;
}): Promise<boolean> {
  const user = await options.interaction.guild?.members.fetch(options.interaction.user.id);
  const bot = await options.interaction.guild?.members.fetch(options.interaction.client.user.id);

  // Check if the user and bot have the required permissions, treating missing permissions as false
  const userHasGuildPermissions = user?.permissions.has(options.userGuildPermissions, true) ?? false;
  const userHasChannelPermissions = options.channel ? user?.permissionsIn(options.channel).has(options.userChannelPermissions, true) ?? false : true;
  const botHasGuildPermissions = bot?.permissions.has(options.botGuildPermissions, true) ?? false;
  const botHasChannelPermissions = options.channel ? bot?.permissionsIn(options.channel).has(options.botChannelPermissions, true) ?? false : true;

  // If any of the required permissions are not met, respond with an error message if the respond flag is true, and return false.
  if (!userHasGuildPermissions || !userHasChannelPermissions || !botHasGuildPermissions || !botHasChannelPermissions) {
    if (options.respond ?? true) {
      await Async.awaitable(
        ResponseBuilder.respond(
          options.interaction,
          ResponseBuilder.basic({
            title: 'Discord Permission Rejection',
            message: [
              `All required permissions must be met to perform this action:`,
              '',
              `**Your Required Guild Permissions**: \`${!userHasGuildPermissions ? options.userGuildPermissions.toString() : 'None'}\``,
              `**Your Required Channel Permissions**: \`${!userHasChannelPermissions ? options.userChannelPermissions.toString() : 'None'}\``,
              `**My Required Guild Permissions**: \`${!botHasGuildPermissions ? options.botGuildPermissions.toString() : 'None'}\``,
              `**My Required Channel Permissions**: \`${!botHasChannelPermissions ? options.botChannelPermissions.toString() : 'None'}\``,
            ].join('\n'),
          }),
        ),
      );
    }
    return false;
  }

  return true;
}
