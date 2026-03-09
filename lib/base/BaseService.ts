/**
 * BaseService is an abstract class that serves as a foundation for all services in the application. It provides a standardized way to create singleton instances of services and ensures that each service implements an asynchronous initialization method. By extending BaseService, individual services can manage their own state and dependencies while adhering to a consistent structure for instantiation and initialization across the application.
 */
export abstract class BaseService {
  protected static instance?: BaseService;

  protected constructor() {}

  // Returns a singleton instance of the subclass with the correct type.
  // Subclasses with constructor parameters can provide their own get method.
  public static async get(...args: unknown[]): Promise<BaseService> {
    if (!this.instance) {
      // deno-lint-ignore no-explicit-any
      this.instance = new (this as any)(...args);
      await this.instance!.initialize();
    }
    return this.instance!;
  }

  protected abstract initialize(): Promise<void>;
}
