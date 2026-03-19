import { Ledger } from 'ledger';
import { BaseService } from '../provider/base/BaseService.ts';

export interface LedgerNativeServiceOptions {
  nativeId: string;
}

/**
 * Service responsible for managing the Ledger logging system.
 */
export class LedgerService extends BaseService {
  private ledger: Ledger;

  /**
   * Initialize the LedgerService with a new Ledger instance configured for the current tenant.
   */
  protected constructor(options: LedgerNativeServiceOptions) {
    super();
    this.ledger = new Ledger({
      service: options.nativeId,
      useAsyncDispatchQueue: true,
    });
  }

  /**
   * Get the singleton instance with constructor parameters.
   */
  public static override get(options: LedgerNativeServiceOptions): Promise<LedgerService> {
    return super.get(options) as Promise<LedgerService>;
  }

  /**
   * Initialize the Ledger by registering handlers and ensuring it's alive before the service is ready.
   */
  protected override async initialize(): Promise<void> {
    await this.ledger.alive();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  /**
   * Get the Ledger instance.
   */
  public instance(): Ledger {
    return this.ledger;
  }
}
