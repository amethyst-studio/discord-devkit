import { type ChatInputCommandInteraction, type InteractionEditReplyOptions, type InteractionReplyOptions, type InteractionUpdateOptions, type MessageComponentInteraction, MessageFlags, type ModalSubmitInteraction, SeparatorSpacingSize } from 'discord.js';
import { ContainerBuilder } from 'discord.js/builders';
import { InternalException } from '../../../../baked/InternalException.ts';
import { NativeServiceProvider } from '../../../../provider/provider.ts';
import { LedgerService } from '../../../LedgerService.ts';
import { BrandingService, DEFAULT_BRANDING } from '../../BrandingService.ts';

export type ResponseBuilderSetupOptions = {
  brand: string;
  stub: string;
  link: string;
  ref: string;
};

export class ResponseBuilder {
  public static basic(packet: {
    title?: string;
    message?: string | (string | null)[];
    thumbnail?: string;
    footer?: {
      format: string | string[];
      hidden?: boolean;
      arguments?: Record<string, string>;
    };
    callback?: (builder: ContainerBuilder) => void;
    interaction?: ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction;
  }): InteractionReplyOptions | InteractionEditReplyOptions | InteractionUpdateOptions {
    const branding = NativeServiceProvider.get().getProvider(BrandingService);
    const builder = new ContainerBuilder();

    // Auto Format Message
    if (packet.message !== undefined && Array.isArray(packet.message)) {
      packet.message = packet.message.filter((v) => v !== null).join('\n');
    }

    // Add Title
    if (packet.title !== undefined && packet.title.length > 0) {
      builder
        .addTextDisplayComponents((b) => b.setContent(`${packet.title}`))
        .addSeparatorComponents((b) => b.setSpacing(SeparatorSpacingSize.Small));
    }

    // Add Message
    if (packet.message !== undefined && packet.message.length > 0) {
      // Thumbnail Variant
      if (packet.thumbnail !== undefined) {
        builder.addSectionComponents((section) => {
          section.addTextDisplayComponents((b) => b.setContent(`${packet.message}`));
          section.setThumbnailAccessory((tn) => tn.setURL(packet.thumbnail!).setDescription('Thumbnail Image'));
          return section;
        }).addSeparatorComponents((b) => b.setSpacing(SeparatorSpacingSize.Small));
      }
      // Base Variant
      else {
        builder
          .addTextDisplayComponents((b) => b.setContent(`${packet.message}`))
          .addSeparatorComponents((b) => b.setSpacing(SeparatorSpacingSize.Small));
      }
    }

    // Run Callback Handler
    if (packet.callback !== undefined) {
      packet.callback(builder);
    }

    // Add Footer
    if ((packet.footer?.hidden ?? false) === false) {
      if (packet.footer === undefined) {
        packet.footer = {
          hidden: false,
          format: '{{TIMESTAMP}}',
          arguments: {},
        };
      }
      if (Array.isArray(packet.footer.format)) {
        packet.footer.format = packet.footer.format.join('\n');
      }
      for (const [key, value] of Object.entries(packet.footer.arguments ?? {})) {
        packet.footer.format = packet.footer.format.replace(`{{${key}}}`, value);
      }
      packet.footer.format = packet.footer.format.replace('{{TIMESTAMP}}', `<t:${Math.floor(Date.now() / 1000)}:F>`);
      packet.footer.format = packet.footer.format.replace('{{INT_BRAND}}', packet?.interaction?.guild?.name ?? branding?.brand ?? DEFAULT_BRANDING.brand);
      packet.footer.format = packet.footer.format.replace('{{INT_STUB}}', branding?.stub ?? DEFAULT_BRANDING.stub);
      packet.footer.format = packet.footer.format.replace('{{INT_LINK}}', branding?.link ?? DEFAULT_BRANDING.link);
      packet.footer.format = packet.footer.format.replace('{{INT_REF}}', branding?.ref ?? DEFAULT_BRANDING.ref);
      builder
        .addTextDisplayComponents((b) => b.setContent(`${(packet.footer!.format as string).split('\n').map((line) => `-# ${line.trim()}`).join('\n')}`));
    }

    // Return Response
    return {
      flags: MessageFlags.IsComponentsV2,
      components: [builder],
    };
  }

  public static paginate(packet: {
    title?: string;
    entryList: string[];
    entryPerPage: number;
    currentPage: number;
    refPreviousPage: string;
    refNextPage: string;
  }): InteractionReplyOptions | InteractionEditReplyOptions | InteractionUpdateOptions {
    if (packet.entryList.length === 0) {
      return ResponseBuilder.basic({
        title: packet.title ?? 'No Entries',
        message: 'We found no entries for the list requested.',
      });
    }
    if (packet.entryPerPage < 1) {
      packet.entryPerPage = 1;
    }
    if (packet.entryPerPage > 10) {
      packet.entryPerPage = 10;
    }

    const hasPreviousPage = packet.currentPage > 0;
    const hasNextPage = packet.entryList.at((packet.currentPage + 1) * packet.entryPerPage) !== undefined;
    packet.entryList = packet.entryList.slice(packet.currentPage * packet.entryPerPage, (packet.currentPage + 1) * packet.entryPerPage);

    return ResponseBuilder.basic({
      title: packet.title ?? 'List of Entries',
      message: packet.entryList.join('\n'),
      callback: (builder) => {
        builder.addActionRowComponents(
          (ar) =>
            ar.addSecondaryButtonComponents(
              (button) => button.setCustomId(packet.refPreviousPage).setLabel('Previous').setDisabled(!hasPreviousPage),
              (button) => button.setCustomId(packet.refNextPage).setLabel('Next').setDisabled(!hasNextPage),
            ),
        );
      },
    });
  }

  public static internal(packet: {
    message: string | (string | null)[];
    footer?: {
      hidden?: boolean;
      format: string | string[];
      arguments?: Record<string, string>;
    };
    cause: Error;
    interaction?: ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction;
  }): InteractionReplyOptions | InteractionEditReplyOptions | InteractionUpdateOptions {
    const branding = NativeServiceProvider.get().getProvider(BrandingService);
    const builder = new ContainerBuilder();

    // Auto Format Message
    if (packet.message !== undefined && Array.isArray(packet.message)) {
      packet.message = packet.message.filter((v) => v !== null).join('\n');
    }

    // Add Message
    if (packet.message !== undefined && packet.message.length > 0) {
      // Base Variant
      builder
        .addTextDisplayComponents((b) => b.setContent(`${packet.message}`))
        .addSeparatorComponents((b) => b.setSpacing(SeparatorSpacingSize.Small));
    }

    // Add Causation
    if (packet.cause !== undefined) {
      const error = new InternalException('An InternalException has occurred with cause.', {
        cause: packet.cause,
      });
      builder
        .addTextDisplayComponents((b) => b.setContent(`-# **Reference ID**: \`${error.ulid}\``))
        .addSeparatorComponents((b) => b.setSpacing(SeparatorSpacingSize.Small));
      NativeServiceProvider.get().getProvider(LedgerService).instance().warning('Non-fatal Tracked Error from ResponseBuilder InternalException.', {
        ulid: error.ulid,
        cause: error,
      });
    }

    // Add Footer
    if ((packet.footer?.hidden ?? false) === false) {
      if (packet.footer === undefined) {
        packet.footer = {
          hidden: false,
          format: '{{TIMESTAMP}}',
          arguments: {},
        };
      }
      if (Array.isArray(packet.footer.format)) {
        packet.footer.format = packet.footer.format.join('\n');
      }
      for (const [key, value] of Object.entries(packet.footer.arguments ?? {})) {
        packet.footer.format = packet.footer.format.replace(`{{${key}}}`, value);
      }
      packet.footer.format = packet.footer.format.replace('{{TIMESTAMP}}', `<t:${Math.floor(Date.now() / 1000)}:F>`);
      packet.footer.format = packet.footer.format.replace('{{INT_BRAND}}', packet?.interaction?.guild?.name ?? branding?.brand ?? DEFAULT_BRANDING.brand);
      packet.footer.format = packet.footer.format.replace('{{INT_STUB}}', branding?.stub ?? DEFAULT_BRANDING.stub);
      packet.footer.format = packet.footer.format.replace('{{INT_LINK}}', branding?.link ?? DEFAULT_BRANDING.link);
      packet.footer.format = packet.footer.format.replace('{{INT_REF}}', branding?.ref ?? DEFAULT_BRANDING.ref);
      builder
        .addTextDisplayComponents((b) => b.setContent(`${(packet.footer!.format as string).split('\n').map((line) => `-# ${line.trim()}`).join('\n')}`));
    }

    // Return Response
    return {
      flags: MessageFlags.IsComponentsV2,
      components: [builder],
    };
  }

  public static async respond(
    interaction:
      | ChatInputCommandInteraction
      | MessageComponentInteraction
      | ModalSubmitInteraction,
    options: InteractionReplyOptions | InteractionEditReplyOptions | InteractionUpdateOptions,
    forceUpdateReply = false,
  ): Promise<void> {
    // Just reply if we do not want to run logic parsing.
    if (forceUpdateReply) {
      if (interaction.deferred) {
        await interaction.editReply(options as InteractionEditReplyOptions);
      }
      else {
        await interaction.reply(options as InteractionReplyOptions);
      }
      return;
    }

    if ((interaction.isButton() && interaction.message) || interaction.isSelectMenu() || (interaction.isModalSubmit() && interaction.isFromMessage())) {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(options as InteractionEditReplyOptions);
      }
      else {
        await interaction.update(options as InteractionUpdateOptions);
      }
      return;
    }

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(options as InteractionEditReplyOptions);
      return;
    }

    // Catch-all Reply
    await interaction.reply(options as InteractionReplyOptions);
  }

  public static async processing(
    interaction: ChatInputCommandInteraction | MessageComponentInteraction | ModalSubmitInteraction,
  ): Promise<void> {
    const response = ResponseBuilder.basic({
      title: 'Awaiting Processing',
      message: 'This request is being processed...',
    });
    await ResponseBuilder.respond(interaction, response, true);
  }
}
