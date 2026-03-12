import { ulid } from '@std/ulid';
import { CronJob } from 'cron';
import { NativeServiceProvider } from '../../mod.provider.ts';
import { BaseService } from '../base/BaseService.ts';
import { DiscordService } from './discord/DiscordService.ts';

export class TaskService extends BaseService {
  private tasks: Map<string, {
    name: string;
    job: CronJob;
  }> = new Map();
  private taskLastExecuted: Map<string, number> = new Map();

  /**
   * Get the singleton instance with constructor parameters.
   */
  public static override get(): Promise<TaskService> {
    return super.get() as Promise<TaskService>;
  }

  /**
   * Initialize the TaskService by setting up a watchdog task that monitors the execution of registered tasks and logs warnings if any task fails to execute within an expected timeframe.
   */
  // deno-lint-ignore require-await
  protected override async initialize(): Promise<void> {
    // deno-lint-ignore require-await
    this.register('TaskService:Watchdog', '*/5 * * * * *', async () => {
      for (const id of this.tasks.keys()) {
        const task = this.tasks.get(id)!;
        const lastExecution = this.taskLastExecuted.get(id)!;
        const timeSinceLastExecution = Math.abs(lastExecution - Date.now());
        const expectedTimeSinceLastExecution = Math.abs((task.job.lastDate()?.getTime() ?? 0) - task.job.nextDate().toMillis());
        if (timeSinceLastExecution > expectedTimeSinceLastExecution * 5) {
          NativeServiceProvider.getLedgerService().getLedger().warning('Task Watchdog Alert', {
            id,
            name: task.name,
            reason: 'Task has not heartbeat within the expected adjusted timeframe.',
            timeSinceLastExecution,
            expectedTimeSinceLastExecution,
            maxTimeSinceLastExecution: expectedTimeSinceLastExecution * 5,
          });
        }
      }
    }, true);
  }

  /**
   * Register a new task with the TaskService, which will be executed according to the provided cron schedule. The task's execution will be monitored by the watchdog, and any errors during execution will be captured and logged by the LedgerService.
   *
   * @param name - A human-readable name for the task, used for logging and identification purposes.
   * @param cronTime - A cron-formatted string that specifies the schedule for task execution (e.g., '0 * * * *' for hourly execution).
   * @param callback - An asynchronous function that contains the logic to be executed when the task runs. This function can perform any necessary operations, such as data processing, API calls, or maintenance tasks.
   * @param waitForCompletion - Whether the task should wait for completion before scheduling the next run (default: true).
   */
  public register(name: string, cronTime: string, callback: () => Promise<void> | void, waitForCompletion = true): void {
    const taskId = ulid();
    this.taskLastExecuted.set(taskId, Date.now());
    this.tasks.set(taskId, {
      name,
      job: CronJob.from({
        cronTime,
        onTick: async () => {
          if (NativeServiceProvider.hasProvider(DiscordService) && !NativeServiceProvider.getDiscordService().getDiscord().isReady()) {
            return;
          }
          await callback();
          this.taskLastExecuted.set(taskId, Date.now());
        },
        start: true,
        waitForCompletion,
        errorHandler: this.capture(`${name}-${taskId}`),
      }),
    });
    NativeServiceProvider.getLedgerService().getLedger().information('TaskService:Register', {
      id: taskId,
      name,
      cronTime,
      waitForCompletion,
    });
  }

  /**
   * Capture any errors that occur during the execution of a task and log them using the LedgerService. This function returns an error handler that can be passed to the CronJob configuration, ensuring that any exceptions thrown during task execution are properly logged with relevant context, such as the task ID and name.
   *
   * @param taskId - The unique identifier for the task, used to provide context in the error logs.
   * @returns - A function that takes an error object and logs it using the LedgerService with a warning level, including details about the task and the error that occurred.
   */
  private capture(taskId: string): (err: unknown) => void {
    return (err: unknown) => {
      NativeServiceProvider.getLedgerService().getLedger().warning('Task Error Handler Invoked', {
        service: 'TaskService',
        taskId: taskId,
        error: err,
      });
    };
  }
}
