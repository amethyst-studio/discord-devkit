import uFuzzy from '@ufuzzy';
import type { APIApplicationCommandOptionChoice, GuildTextBasedChannel } from 'discord.js';
import { NativeServiceProvider } from '../../../../mod.provider.ts';
import { isAutoCompleteHandler, isComponentHandler, isModalHandler } from '../../../base/BaseCommand.ts';
import { Async } from '../../../util/Async.ts';
import { ResponseBuilder } from '../../../util/baked/flow/ResponseBuilder.ts';
import { LedgerService } from '../../LedgerService.ts';

export class InternalCommandHandler {
  // deno-lint-ignore require-await
  public static async initialize(): Promise<void> {
    const ledger = NativeServiceProvider.get().getProvider(LedgerService).instance();
    const discord = NativeServiceProvider.get().getProvider(DiscordService).getDiscord();

    discord.on(
      'interactionCreate',
      (interaction) => {
        const awaitable = Async.awaitable(async () => {
          if (interaction.isChatInputCommand()) {
            if (!interaction.inGuild()) {
              return;
            }

            const path = [
              interaction.command?.name,
              interaction.options.getSubcommandGroup(),
              interaction.options.getSubcommand(),
            ].filter((v) => v !== undefined && v !== null).join('.');
            const registered = discord.crs.getRegistered(path);
            if (registered === null) {
              return;
            }

            // Guard: Developer Only
            if (registered.options.developer) {
              if (interaction.user.id !== '100737000973275136') {
                const awaitResponse = await Async.awaitable(
                  ResponseBuilder.respond(
                    interaction,
                    ResponseBuilder.basic({
                      title: 'Developer Command Restricted',
                      message: [
                        'This command is restricted to our developers only. The execution context has been halted.',
                        '',
                        '-# Hey now, you found a secret! This command is currently restricted to the developers only. If you believe you should have access to this command, please contact us.',
                      ],
                    }),
                  ),
                );
                if (Async.isAwaitableException(awaitResponse)) {
                  ledger.warning('Failed to send developer command restricted response', {
                    err: awaitResponse.err,
                  });
                }
                return;
              }
            }

            // Guard: Guild Only
            if (registered.options.guild) {
              if (interaction.guild === null || !interaction.inGuild()) {
                const awaitResponse = await Async.awaitable(
                  ResponseBuilder.respond(
                    interaction,
                    ResponseBuilder.basic({
                      title: 'Guild Only Command Restricted',
                      message: [
                        'This command can only be used in a server context. The execution context has been halted.',
                        '',
                        "-# Achievement Unlocked: How Did We Get Here? This shouldn't even be possible! Report an issue, please, if you believe this is unexpected.",
                      ],
                    }),
                  ),
                );
                if (Async.isAwaitableException(awaitResponse)) {
                  ledger.warning('Failed to send guild only restricted response', {
                    err: awaitResponse.err,
                  });
                }
                return;
              }

              // Invoker Permission Check
              if (
                !(await Permissions.hasRequiredPermissions({
                  interaction,
                  channel: interaction.channel as GuildTextBasedChannel,
                  userGuildPermissions: registered.options.userPermissions ?? [],
                  userChannelPermissions: registered.options.userChannelPermissions ?? [],
                  botGuildPermissions: registered.options.botPermissions ?? [],
                  botChannelPermissions: registered.options.botChannelPermissions ?? [],
                }))
              ) {
                return;
              }
            }

            // Execute Command Callback
            const awaitExecute = await Async.awaitable(
              registered.execute(interaction),
            );
            if (Async.isAwaitableException(awaitExecute)) {
              ledger.warning('Failed to Execute', {
                path,
                err: awaitExecute.err,
              });
            }
          }

          if (interaction.isMessageComponent()) {
            if (interaction.customId === null || interaction.customId.length === 0) {
              const awaitResponse = await Async.awaitable(
                ResponseBuilder.respond(
                  interaction,
                  ResponseBuilder.basic({
                    title: 'Invalid Interaction Callback ID',
                    message: 'The Callback ID is missing or invalid. Please report an issue if this persists.',
                  }),
                ),
              );
              if (Async.isAwaitableException(awaitResponse)) {
                ledger.warning('Failed to send invalid interaction callback id response', {
                  err: awaitResponse.err,
                });
              }
              return;
            }

            const ref = discord.crs.getRegisteredByReference(interaction.customId);
            if (ref === null) {
              const awaitResponse = await Async.awaitable(
                ResponseBuilder.respond(
                  interaction,
                  ResponseBuilder.basic({
                    title: 'Interaction Reference Not Found',
                    message: 'The interaction reference could not be found. It may have expired or is missing. Please execute the original request and try again. Report an issue if this persists over multiple attempts.',
                  }),
                ),
              );
              if (Async.isAwaitableException(awaitResponse)) {
                ledger.warning('Failed to send message component reference not found response', {
                  err: awaitResponse.err,
                });
              }
              return;
            }

            if (isComponentHandler(ref)) {
              const awaitComponent = await Async.awaitable(
                ref.component(interaction),
              );
              if (Async.isAwaitableException(awaitComponent)) {
                ledger.severe('Failed to Process interactionCreate for MessageComponent', {
                  err: awaitComponent.err,
                });
              }
            }
          }

          if (interaction.isModalSubmit()) {
            if (interaction.customId === null || interaction.customId.length === 0) {
              const awaitResponse = await Async.awaitable(
                ResponseBuilder.respond(
                  interaction,
                  ResponseBuilder.basic({
                    title: 'Invalid Interaction Custom ID',
                    message: 'The interaction custom ID was missing or invalid. The execution context has been halted.',
                  }),
                ),
              );
              if (Async.isAwaitableException(awaitResponse)) {
                ledger.warning('Failed to send invalid interaction custom id response', {
                  err: awaitResponse.err,
                });
              }
              return;
            }

            const ref = discord.crs.getRegisteredByReference(interaction.customId);
            if (ref === null) {
              const awaitResponse = await Async.awaitable(
                ResponseBuilder.respond(
                  interaction,
                  ResponseBuilder.basic({
                    title: 'Interaction Reference Not Found',
                    message: 'The interaction reference could not be found. It may have expired or is missing. Please execute the original request and try again. Report an issue if this persists over multiple attempts.',
                  }),
                ),
              );
              if (Async.isAwaitableException(awaitResponse)) {
                ledger.warning('Failed to send modal reference not found response', {
                  err: awaitResponse.err,
                });
              }
              return;
            }

            if (isModalHandler(ref)) {
              const awaitModal = await Async.awaitable(
                ref.modal(interaction),
              );
              if (Async.isAwaitableException(awaitModal)) {
                ledger.severe('Failed to Process interactionCreate for ModalSubmit', {
                  err: awaitModal.err,
                });
              }
            }
          }

          if (interaction.isAutocomplete()) {
            const path = [
              interaction.command?.name,
              interaction.options.getSubcommandGroup(),
              interaction.options.getSubcommand(),
            ].filter((v) => v !== undefined && v !== null).join('.');
            const registered = discord.crs.getRegistered(path);
            if (registered === null) {
              return;
            }

            let acr: AutoCompleteResponse | null = {
              results: [],
              allowEmptySearch: true,
              perPage: 10,
            };
            if (isAutoCompleteHandler(registered)) {
              const awaitAutocomplete = await Async.awaitable(
                registered.autocomplete(interaction),
              );
              if (Async.isAwaitableException(awaitAutocomplete)) {
                ledger.severe('Failed to Process interactionCreate for ChatAutoComplete', {
                  err: awaitAutocomplete.err,
                });
                acr = null;
              }
              else {
                acr = awaitAutocomplete;
              }
            }
            if (acr === null) {
              return;
            }

            // Respond with no results message if no results found.
            if (acr.results.length === 0) {
              const awaitRespond = await Async.awaitable(
                interaction.respond([{
                  name: 'Search returned no results with the current inquiry.',
                  value: 'null',
                }]),
              );
              if (Async.isAwaitableException(awaitRespond)) {
                ledger.warning('Failed to respond with autocomplete no results', {
                  err: awaitRespond.err,
                });
              }
              return;
            }

            // Lookup an Exact Match by Value.
            const exactMatch = acr.results.find((result) => result.value === interaction.options.getFocused()?.value);
            if (exactMatch !== undefined) {
              const awaitRespond = await Async.awaitable(
                interaction.respond([exactMatch]),
              );
              if (Async.isAwaitableException(awaitRespond)) {
                ledger.warning('Failed to respond with autocomplete exact match', {
                  err: awaitRespond.err,
                });
              }
              return;
            }

            // Prepare value lookback map for fuzzy search.
            const valueLookback = new Map<string, string>();
            for (const result of acr.results) {
              valueLookback.set(result.name, `${result.value ?? result.name}`);
            }

            // Prepare haystack for fuzzy search.
            const haystack = acr.results.map((result) => result.name);
            const needle = `${interaction.options.getFocused()?.value ?? ''}`.trim();
            const uf = new uFuzzy();
            const choices: APIApplicationCommandOptionChoice[] = [];

            // Perform fuzzy search and respond with filtered choices.
            if (needle === '' && acr.allowEmptySearch) {
              choices.push(...acr.results);
            }
            else {
              const idxs = uf.filter(haystack, needle);

              if (idxs === null || idxs.length === 0) {
                const awaitRespond = await Async.awaitable(
                  interaction.respond([{
                    name: 'Search returned no results with the current inquiry.',
                    value: 'null',
                  }]),
                );
                if (Async.isAwaitableException(awaitRespond)) {
                  ledger.warning('Failed to respond with autocomplete no results', {
                    err: awaitRespond.err,
                  });
                }
                return;
              }

              if (idxs.length <= 500) {
                const info = uf.info(idxs, haystack, needle);
                const order = uf.sort(info, haystack, needle);
                const limit = Math.min(order.length, acr.perPage ?? 10, 10);

                for (let i = 0; i < limit; i++) {
                  const name = haystack[info.idx[order[i]]];
                  choices.push({
                    name: name.substring(0, 100),
                    value: valueLookback.get(name)?.substring(0, 100) ?? name.substring(0, 100),
                  });
                }
              }
              else {
                const awaitRespond = await Async.awaitable(
                  interaction.respond([{
                    name: 'Search returned too many results (over 500). Please refine your search first.',
                    value: 'null',
                  }]),
                );
                if (Async.isAwaitableException(awaitRespond)) {
                  ledger.warning('Failed to respond with autocomplete too many results', {
                    err: awaitRespond.err,
                  });
                }
                return;
              }
            }

            // Respond with filtered choices.
            if (acr.perPage === undefined) {
              acr.perPage = 10;
            }
            if (acr.perPage > 25) {
              acr.perPage = 25;
            }
            if (acr.perPage > choices.length) {
              acr.perPage = choices.length;
            }
            const awaitRespond = await Async.awaitable(
              interaction.respond(
                choices.slice(
                  0,
                  acr.perPage,
                ),
              ),
            );
            if (Async.isAwaitableException(awaitRespond)) {
              ledger.warning('Failed to respond with autocomplete choices', {
                err: awaitRespond.err,
              });
            }
          }
        });

        if (Async.isAwaitableException(awaitable)) {
          ledger.severe('Failed InternalCommandHandler', {
            event: 'InternalCommandHandler',
            error: awaitable.err,
          });
        }
      },
    );
  }
}

export type AutoCompleteResponse = {
  results: APIApplicationCommandOptionChoice[];
  perPage?: number;
  allowEmptySearch?: boolean;
};
