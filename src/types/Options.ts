import {Auth} from './Auth.js';
import {DnsRecord} from './cloudflare/RecordData.js';
import {RecordInput} from './Record.js';

export type RecordSelection = RecordInput | Array<RecordInput>;

export type DdnsOptions = Auth & {
  records?: RecordSelection;
};

export type SyncOptions = {
  ipv4?: string;
  ipv6?: string;
};

export type JobOptions = SyncOptions & {
  records?: RecordSelection;
  onSync?: (records: Array<DnsRecord>) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
};

export type WatchOptions = JobOptions & {
  intervalMs?: number;
};

export type ListOptions = {
  records?: RecordSelection;
  domains?: string | Array<string>;
  groupBy?: 'domain';
};

export type SyncJob = {
  run(): Promise<Array<DnsRecord>>;
  start(): Promise<void>;
  stop(): Promise<void>;
};
