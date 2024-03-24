import {Record as CloudflareRecordTypes} from 'cloudflare';

export type RecordTypes = Exclude<CloudflareRecordTypes, 'MX' | 'SRV' | 'URI'>;

export type Record = {
  name: string;
  type?: RecordTypes;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
  content?: string;
};
