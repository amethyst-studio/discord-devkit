import { ulid } from '@std/ulid';
import { NativeServiceProvider } from '../../mod.provider.ts';
import { BaseService } from '../base/BaseService.ts';
import { LedgerService } from './LedgerService.ts';

export type MsTaskSchedulerOverrunPolicy = 'skip' | 'delay';

export type MsTaskSchedulerTaskOptions = {
  immediate?: boolean;
  overrunPolicy?: MsTaskSchedulerOverrunPolicy;
  enabled?: boolean;
  maxRunTimeMs?: number;
};

export type MsTaskSchedulerExecutionContext = {
  taskId: string;
  taskName: string;
  signal: AbortSignal;
};

export type MsTaskSchedulerTaskSnapshot = {
  id: string;
  name: string;
  intervalMs: number;
  immediate: boolean;
  overrunPolicy: MsTaskSchedulerOverrunPolicy;
  enabled: boolean;
  maxRunTimeMs: number | null;
  running: boolean;
  failureCount: number;
  timeoutCount: number;
  overrunCount: number;
  runCount: number;
  lastStartedAt: number | null;
  lastCompletedAt: number | null;
  nextRunAt: number | null;
};

type MsTaskSchedulerTask = MsTaskSchedulerTaskSnapshot & {
  callback: (context: MsTaskSchedulerExecutionContext) => Promise<void> | void;
  timer: ReturnType<typeof setTimeout> | null;
  disposed: boolean;
  nextRunMonotonicAt: number | null;
  lastStartedMonotonicAt: number | null;
  lastCompletedMonotonicAt: number | null;
};

/**
 * MsTaskScheduler is a high-precision millisecond-based task scheduler for executing tasks at regular intervals. It provides fine-grained control over task timing, overrun handling, and execution monitoring. The service uses a monotonic clock for timing accuracy and automatically monitors task health through a built-in watchdog.
 *
 * Key features:
 * - Millisecond-level precision with adaptive polling (down to 1ms)
 * - Configurable overrun policies: 'skip' (fixed-rate) or 'delay' (fixed-delay)
 * - Optional per-task runtime limits with cooperative cancellation
 * - Built-in watchdog monitoring for task failures, timeouts, and overruns
 * - Monotonic clock-based scheduling with wall-clock time reporting
 */
export class MsTaskScheduler extends BaseService {
  private static readonly PRECISION_WINDOW_MS = 4;
  private static readonly PRECISION_POLL_MS = 1;

  private readonly tasks = new Map<string, MsTaskSchedulerTask>();
  private readonly monotonicEpochMs = performance.now();
  private readonly wallClockEpochMs = Date.now();

  protected constructor() {
    super();
  }

  public static override get(): Promise<MsTaskScheduler> {
    return super.get() as Promise<MsTaskScheduler>;
  }

  /**
   * Initialize the MsTaskScheduler by setting up a watchdog task that monitors the execution of registered tasks and logs warnings if any task fails, times out, or experiences overruns.
   */
  protected override initialize(): Promise<void> {
    this.register('MsTaskScheduler:Watchdog', 5000, () => {
      for (const task of this.tasks.values()) {
        if (task.disposed) {
          continue;
        }
        const hasIssues = task.failureCount > 0 || task.timeoutCount > 0 || task.overrunCount > 0;
        if (hasIssues) {
          const nsp = NativeServiceProvider.get();
          if (nsp.hasProvider(LedgerService)) {
            nsp.getProvider(LedgerService).instance().warning('MsTaskScheduler:TaskWatchdog', {
              id: task.id,
              name: task.name,
              failureCount: task.failureCount,
              timeoutCount: task.timeoutCount,
              overrunCount: task.overrunCount,
              runCount: task.runCount,
              running: task.running,
            });
          }
        }
      }
    }, { immediate: false });
    return Promise.resolve();
  }

  /**
   * Register and start a new task with the MsTaskScheduler, which will be executed at the specified interval. The task's execution will be monitored by the watchdog, and any errors, timeouts, or overruns will be captured and logged by the LedgerService.
   *
   * @param name - A human-readable name for the task, used for logging and identification purposes.
   * @param intervalMs - The interval in milliseconds at which the task should be executed. Minimum value is 1ms.
   * @param callback - An asynchronous function that contains the logic to be executed when the task runs. The callback receives an execution context with the task ID, name, and an AbortSignal for cooperative cancellation.
   * @param options - Optional configuration for the task, including immediate start, overrun policy, enabled state, and max runtime.
   * @returns - A unique task ID string that can be used to manage (start, stop, unregister) or query the task.
   */
  public register(
    name: string,
    intervalMs: number,
    callback: () => Promise<void> | void,
    options: MsTaskSchedulerTaskOptions = {},
  ): string {
    const normalizedIntervalMs = Math.max(1, Math.floor(intervalMs));
    const immediate = options.immediate ?? false;
    const overrunPolicy = options.overrunPolicy ?? 'skip';
    const enabled = options.enabled ?? true;
    const maxRunTimeMs = options.maxRunTimeMs === undefined ? null : Math.max(1, Math.floor(options.maxRunTimeMs));
    const now = Date.now();
    const nowMonotonic = performance.now();
    const taskId = ulid();

    const task: MsTaskSchedulerTask = {
      id: taskId,
      name,
      intervalMs: normalizedIntervalMs,
      immediate,
      overrunPolicy,
      enabled,
      maxRunTimeMs,
      running: false,
      failureCount: 0,
      timeoutCount: 0,
      overrunCount: 0,
      runCount: 0,
      lastStartedAt: null,
      lastCompletedAt: null,
      nextRunAt: enabled ? (immediate ? now : now + normalizedIntervalMs) : null,
      callback,
      timer: null,
      disposed: false,
      nextRunMonotonicAt: enabled ? (immediate ? nowMonotonic : nowMonotonic + normalizedIntervalMs) : null,
      lastStartedMonotonicAt: null,
      lastCompletedMonotonicAt: null,
    };

    this.tasks.set(taskId, task);
    const nsp = NativeServiceProvider.get();
    if (nsp.hasProvider(LedgerService)) {
      nsp.getProvider(LedgerService).instance().information('MsTaskScheduler:Register', {
        id: task.id,
        name: task.name,
        intervalMs: task.intervalMs,
        immediate: task.immediate,
        overrunPolicy: task.overrunPolicy,
        enabled: task.enabled,
        maxRunTimeMs: task.maxRunTimeMs,
      });
    }
    this.schedule(task, task.nextRunMonotonicAt);
    return taskId;
  }

  /**
   * Unregister and remove a task from the scheduler. The task will be stopped if running and all associated timers will be cleared.
   *
   * @param taskId - The unique identifier of the task to unregister.
   * @returns - True if the task was successfully unregistered, false if the task was not found.
   */
  public unregister(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    this.clearTimer(task);
    task.disposed = true;
    this.tasks.delete(taskId);
    const nsp = NativeServiceProvider.get();
    if (nsp.hasProvider(LedgerService)) {
      nsp.getProvider(LedgerService).instance().information('MsTaskScheduler:Unregister', {
        id: task.id,
        name: task.name,
      });
    }
    return true;
  }

  /**
   * Start or resume a previously stopped task. If the task is already enabled, this method has no effect. The task will be scheduled to run at the next interval.
   *
   * @param taskId - The unique identifier of the task to start.
   * @throws - Throws an error if the task is not registered or has been disposed.
   */
  public start(taskId: string): void {
    const task = this.mustGetTask(taskId);
    if (task.enabled) {
      return;
    }

    task.enabled = true;
    task.nextRunMonotonicAt = performance.now() + task.intervalMs;
    task.nextRunAt = this.toWallClockTime(task.nextRunMonotonicAt);
    this.schedule(task, task.nextRunMonotonicAt);
  }

  /**
   * Stop or pause a running task. If the task is already disabled, this method has no effect. The task can be resumed later with the start() method. Any pending timers are cleared immediately.
   *
   * @param taskId - The unique identifier of the task to stop.
   * @throws - Throws an error if the task is not registered or has been disposed.
   */
  public stop(taskId: string): void {
    const task = this.mustGetTask(taskId);
    task.enabled = false;
    task.nextRunAt = null;
    task.nextRunMonotonicAt = null;
    this.clearTimer(task);
  }

  /**
   * Retrieve a snapshot of a single task's current state, including execution statistics, timing information, and configuration.
   *
   * @param taskId - The unique identifier of the task to query.
   * @returns - A snapshot of the task's state, or null if the task is not found or has been disposed.
   */
  public getTask(taskId: string): MsTaskSchedulerTaskSnapshot | null {
    const task = this.tasks.get(taskId);
    return task ? this.toSnapshot(task) : null;
  }

  /**
   * Retrieve snapshots of all currently registered tasks. Each snapshot includes execution statistics, timing information, and configuration for the task.
   *
   * @returns - An array of task snapshots, or an empty array if no tasks are registered.
   */
  public getTasks(): MsTaskSchedulerTaskSnapshot[] {
    return [...this.tasks.values()].map((task) => this.toSnapshot(task));
  }

  private schedule(task: MsTaskSchedulerTask, runAtMonotonic: number | null): void {
    this.clearTimer(task);
    if (!task.enabled || task.disposed || runAtMonotonic === null) {
      return;
    }

    task.nextRunMonotonicAt = runAtMonotonic;
    task.nextRunAt = this.toWallClockTime(runAtMonotonic);
    this.armTimer(task);
  }

  private armTimer(task: MsTaskSchedulerTask): void {
    const runAtMonotonic = task.nextRunMonotonicAt;
    if (!task.enabled || task.disposed || runAtMonotonic === null) {
      return;
    }

    const nowMonotonic = performance.now();
    const remainingMs = runAtMonotonic - nowMonotonic;
    if (remainingMs <= 0) {
      task.timer = setTimeout(() => {
        void this.execute(task.id);
      }, 0);
      return;
    }

    if (remainingMs > MsTaskScheduler.PRECISION_WINDOW_MS) {
      task.timer = setTimeout(() => {
        this.armTimer(task);
      }, Math.max(1, Math.floor(remainingMs - MsTaskScheduler.PRECISION_WINDOW_MS)));
      return;
    }

    task.timer = setTimeout(() => {
      this.armTimer(task);
    }, Math.min(MsTaskScheduler.PRECISION_POLL_MS, remainingMs));
  }

  private async execute(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.disposed || !task.enabled) {
      return;
    }

    if (task.running) {
      task.overrunCount += 1;
      if (task.overrunPolicy === 'delay') {
        this.schedule(task, performance.now() + 1);
      }
      else {
        this.schedule(task, (task.nextRunMonotonicAt ?? performance.now()) + task.intervalMs);
      }
      return;
    }

    task.running = true;
    task.lastStartedAt = Date.now();
    task.lastStartedMonotonicAt = performance.now();
    task.runCount += 1;

    const controller = new AbortController();
    const callbackPromise = Promise.resolve(task.callback({
      taskId: task.id,
      taskName: task.name,
      signal: controller.signal,
    }));
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let finalizeOnPromiseSettlement = false;

    try {
      if (task.maxRunTimeMs === null) {
        await callbackPromise;
      }
      else {
        const outcome = await Promise.race([
          callbackPromise.then(
            () => ({ type: 'success' as const }),
            (error) => ({ type: 'error' as const, error }),
          ),
          new Promise<{ type: 'timeout'; error: Error }>((resolve) => {
            timeoutHandle = setTimeout(() => {
              const error = new Error(`Task "${task.name}" exceeded max runtime of ${task.maxRunTimeMs}ms.`);
              controller.abort(error);
              resolve({ type: 'timeout', error });
            }, task.maxRunTimeMs!);
          }),
        ]);

        if (outcome.type === 'error') {
          throw outcome.error;
        }

        if (outcome.type === 'timeout') {
          task.failureCount += 1;
          task.timeoutCount += 1;
          const nsp = NativeServiceProvider.get();
          if (nsp.hasProvider(LedgerService)) {
            nsp.getProvider(LedgerService).instance().warning('MsTaskScheduler:TaskTimeout', {
              id: task.id,
              name: task.name,
              error: outcome.error,
              failureCount: task.failureCount,
              timeoutCount: task.timeoutCount,
              maxRunTimeMs: task.maxRunTimeMs,
            });
          }
          finalizeOnPromiseSettlement = true;
          void callbackPromise.catch(() => {}).finally(() => {
            this.finishExecution(task);
          });
          return;
        }
      }
    }
    catch (error) {
      task.failureCount += 1;
      const nsp = NativeServiceProvider.get();
      if (nsp.hasProvider(LedgerService)) {
        nsp.getProvider(LedgerService).instance().warning('MsTaskScheduler:TaskFailure', {
          id: task.id,
          name: task.name,
          error,
          failureCount: task.failureCount,
        });
      }
    }
    finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
      if (!finalizeOnPromiseSettlement) {
        this.finishExecution(task);
      }
    }
  }

  private finishExecution(task: MsTaskSchedulerTask): void {
    task.running = false;
    task.lastCompletedAt = Date.now();
    task.lastCompletedMonotonicAt = performance.now();

    if (!task.enabled || task.disposed) {
      task.nextRunAt = null;
      task.nextRunMonotonicAt = null;
      return;
    }

    const nowMonotonic = performance.now();
    const nextRunAtMonotonic = task.overrunPolicy === 'delay' ? (task.lastCompletedMonotonicAt ?? nowMonotonic) + task.intervalMs : (() => {
      const previousTarget = task.nextRunMonotonicAt ?? nowMonotonic;
      const candidate = previousTarget + task.intervalMs;
      if (candidate > nowMonotonic) {
        return candidate;
      }

      const intervalsBehind = Math.floor((nowMonotonic - candidate) / task.intervalMs) + 1;
      return candidate + (intervalsBehind * task.intervalMs);
    })();

    if (nextRunAtMonotonic <= performance.now() && task.overrunPolicy === 'delay') {
      this.schedule(task, performance.now() + 1);
    }
    else {
      this.schedule(task, nextRunAtMonotonic);
    }
  }

  private clearTimer(task: MsTaskSchedulerTask): void {
    if (task.timer !== null) {
      clearTimeout(task.timer);
      task.timer = null;
    }
  }

  private mustGetTask(taskId: string): MsTaskSchedulerTask {
    const task = this.tasks.get(taskId);
    if (!task || task.disposed) {
      throw new Error(`Task "${taskId}" is not registered.`);
    }
    return task;
  }

  private toSnapshot(task: MsTaskSchedulerTask): MsTaskSchedulerTaskSnapshot {
    return {
      id: task.id,
      name: task.name,
      intervalMs: task.intervalMs,
      immediate: task.immediate,
      overrunPolicy: task.overrunPolicy,
      enabled: task.enabled,
      maxRunTimeMs: task.maxRunTimeMs,
      running: task.running,
      failureCount: task.failureCount,
      timeoutCount: task.timeoutCount,
      overrunCount: task.overrunCount,
      runCount: task.runCount,
      lastStartedAt: task.lastStartedAt,
      lastCompletedAt: task.lastCompletedAt,
      nextRunAt: task.nextRunAt,
    };
  }

  private toWallClockTime(monotonicMs: number): number {
    return this.wallClockEpochMs + (monotonicMs - this.monotonicEpochMs);
  }
}
