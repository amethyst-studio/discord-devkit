import { ulid } from '@std/ulid';

export class InternalException extends Error {
  public ulid: string;

  public constructor(message: string, options?: {
    ulid?: string;
    cause?: Error | unknown;
  }) {
    super(message, options);
    this.name = 'InternalException';
    this.ulid = options?.ulid ?? ulid();
  }
}
