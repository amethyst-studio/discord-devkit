import { BaseService } from '../../provider/base/BaseService.ts';

export const DEFAULT_BRANDING: Required<BrandingServiceOptions> = {
  brand: 'Official Companion Bot',
  stub: 'Created by <@100737000973275136>.',
  link: 'https://github.com/xCykrix',
  ref: '',
};

export class BrandingService extends BaseService {
  public readonly brand: string;
  public readonly stub: string;
  public readonly link: string;
  public readonly ref: string;

  protected constructor(options: BrandingServiceOptions = {}) {
    super();
    this.brand = options.brand ?? DEFAULT_BRANDING.brand;
    this.stub = options.stub ?? DEFAULT_BRANDING.stub;
    this.link = options.link ?? DEFAULT_BRANDING.link;
    this.ref = options.ref ?? DEFAULT_BRANDING.ref;
  }

  public static override get(options: BrandingServiceOptions = {}): Promise<BrandingService> {
    return super.get(options) as Promise<BrandingService>;
  }

  protected override async initialize(): Promise<void> {
    return await Promise.resolve();
  }
}

export type BrandingServiceOptions = {
  brand?: string;
  stub?: string;
  link?: string;
  ref?: string;
};
