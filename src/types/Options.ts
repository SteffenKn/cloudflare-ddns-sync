import {Auth} from './Auth.js';
import {DnsRecord} from './cloudflare/RecordData.js';
import {RecordInput} from './Record.js';

export type RecordSelection = RecordInput | Array<RecordInput>;

export type DdnsOptions = Auth & {
  records?: RecordSelection;
  zone?: string;
  resolveIp?: (family: 4 | 6) => string | Promise<string>;
};

export type SyncOptions = {
  ipv4?: string;
  ipv6?: string;
};

export type SyncChange = {
  record: RecordInput;
  action: 'create' | 'update' | 'unchanged';
  before?: DnsRecord;
  after: RecordInput;
};

export type JobOptions = SyncOptions & {
  records?: RecordSelection;
  onSync?: (records: Array<DnsRecord>) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
};

export type WatchOptions = JobOptions & {
  intervalMs?: number;
};

export type RecordListOptions = {
  records?: RecordSelection;
  domains?: never;
  groupBy?: never;
};

export type DomainListOptions = {
  records?: never;
  domains?: string | Array<string>;
  groupBy?: never;
};

export type GroupedDomainListOptions = {
  records?: never;
  domains: string | Array<string>;
  groupBy: 'domain';
};

export type ListOptions = RecordListOptions | DomainListOptions | GroupedDomainListOptions;

export type SyncJob = {
  run(): Promise<Array<DnsRecord>>;
  start(): Promise<void>;
  stop(): Promise<void>;
};
