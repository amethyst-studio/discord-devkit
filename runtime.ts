import { LedgerService } from './lib/service/LedgerService.ts';
import { MsTaskScheduler } from './lib/service/MsTaskScheduler.ts';
import { NativeServiceProvider } from './mod.provider.ts';

await NativeServiceProvider.get().register(LedgerService, {
  nativeId: 'example-tenant',
  discordAccentMessage: 'Example Tenant Alert',
  webhookId: Deno.env.get('DISCORD_WEBHOOK_ID')!,
  webhookToken: Deno.env.get('DISCORD_WEBHOOK_TOKEN')!,
});
await NativeServiceProvider.get().register(MsTaskScheduler);

const scheduler = NativeServiceProvider.get().getProvider(MsTaskScheduler);

const id = scheduler.register('test', 100, async () => {
  console.log('Task executed at', new Date().toISOString());
  if (Math.random() <= 0.05) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}, {
  overrunPolicy: 'skip',
});

scheduler.start(id);
