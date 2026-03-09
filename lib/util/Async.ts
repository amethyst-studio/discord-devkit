/**
 * Async Core Module Class. Provides helper functions for handling async operations, such as bundling, wrapping, and error handling.
 */
export class Async {
  /**
   * Wraps an awaitable in a try/catch and returns a standardized error object on failure, allowing for more graceful error handling without throwing exceptions.
   *
   * @param id - An identifier for logging purposes, to indicate which awaitable is being processed.
   * @param awaitable - The Promise to be awaited, which may resolve successfully or reject with an error.
   * @returns A Promise that resolves to either the successful result of the awaitable or an object containing error information if the awaitable was rejected.
   */
  public static async awaitable<T>(_id: string, awaitable: Promise<T>): Promise<
    T | {
      error: true;
      err: Error;
    }
  > {
    const result = await awaitable.catch((e) => {
      return {
        error: true,
        err: e as Error,
      } as const;
    });
    return result;
  }

  /**
   * Executes an awaitable factory and retries failures up to the provided attempt limit.
   *
   * @param id - An identifier for logging purposes, to indicate which awaitable is being processed.
   * @param awaitableFactory - A callback that creates the Promise to run for each attempt.
   * @param maxRetries - Total number of attempts allowed, including the first attempt. Defaults to 3.
   * @returns The successful result with failure count, or the final error with failure count.
   */
  public static async awaitWithRetry<T>(
    id: string,
    awaitableFactory: () => Promise<T>,
    maxRetries = 1,
  ): Promise<
    {
      result: T;
      failureCount: number;
    } | {
      error: true;
      err: Error;
      failureCount: number;
    }
  > {
    const totalAttempts = Math.max(1, maxRetries);
    let failureCount = 0;

    let result = await this.awaitable(id, awaitableFactory());
    while (this.isAwaitableException(result) && failureCount < totalAttempts - 1) {
      failureCount += 1;
      result = await this.awaitable(id, awaitableFactory());
    }

    if (this.isAwaitableException(result)) {
      return {
        error: true,
        err: result.err,
        failureCount: failureCount + 1,
      };
    }

    return {
      result,
      failureCount,
    };
  }

  /**
   * Executes an array of awaitable factories in order, retrying failures for each one.
   * Only proceeds to the next awaitable after the current one succeeds or exhausts retries.
   * Returns an awaitable exception immediately if any awaitable fails after exhausting all retries.
   *
   * @param id - An identifier for logging purposes, to indicate which operation is being processed.
   * @param awaitableFactories - An array of callbacks that create Promises to be executed in order.
   * @param maxRetries - Total number of attempts allowed per awaitable, including the first attempt. Defaults to 1.
   * @returns An array of successful results, or an error object if any awaitable fails after all retries.
   */
  public static async awaitWithOrderedRetry<T>(
    id: string,
    awaitableFactories: Array<() => Promise<T>>,
    maxRetries = 1,
  ): Promise<T[] | { error: true; err: Error }> {
    const results: T[] = [];

    for (let i = 0; i < awaitableFactories.length; i++) {
      const factory = awaitableFactories[i];
      const result = await this.awaitWithRetry(`${id}[${i}]`, factory, maxRetries);

      if (this.isAwaitableException(result)) {
        return {
          error: true,
          err: new Error(
            `Failed to execute ${id}[${i}] after ${result.failureCount} attempts: ${result.err.message}`,
            { cause: result.err },
          ),
        };
      }

      results.push(result.result);
    }

    return results;
  }

  /**
   * Check if a value is an error object returned by Async.awaitable, which indicates that the original awaitable was rejected and contains error information.
   *
   * @param value - The value to check, which may be the successful result of an awaitable or an error object.
   * @returns A boolean indicating whether the value is an error object with the expected structure.
   */
  public static isAwaitableException(value: unknown): value is {
    error: true;
    err: Error;
  } {
    return (typeof value === 'object' && value !== null && 'error' in value && (value as { error?: boolean }).error === true);
  }

  /**
   * Wraps an async callback function and returns a new function that executes the callback and logs any errors that occur, without throwing exceptions. This allows for graceful error handling in asynchronous operations without interrupting the flow of the program.
   *
   * Maintains the original types of the arguments passed to the callback, ensuring it is easily typed for usage.
   *
   * @param callback - The asynchronous callback function to be wrapped, which may perform any async operations and may throw errors.
   * @returns - A new function that, when called, executes the original callback and logs any errors that occur without throwing exceptions.
   */
  public static bundle<Args extends unknown[]>(
    id: string,
    callback: (...args: Args) => Promise<void>,
  ): (...args: Args) => void {
    return (...args: Args): void => {
      new Promise<void>((resolve) => {
        callback(...args).catch((err) => {
          // TODO: Error Handling on Failed Bundle? Redesign/Ledger it?
        }).then(() => resolve());
      });
    };
  }
}
