import {isIP} from 'node:net';

import CloudflareClient from './lib/cloudflare-client.js';
import IPUtils from './lib/ip-utils.js';
import {SyncError} from './lib/sync-error.js';
import {ScheduledSyncJob, WatchSyncJob} from './lib/sync-job.js';
import {
  Auth,
  DdnsOptions,
  DnsRecord,
  DomainListOptions,
  GroupedDomainListOptions,
  JobOptions,
  ListOptions,
  Record,
  RecordListOptions,
  RecordSelection,
  SyncJob,
  SyncChange,
  SyncOptions,
  WatchOptions,
} from './types/index.js';

const defaultWatchIntervalMs = 10_000;
const maxTimerDelayMs = 2_147_483_647;
const recordTypes = new Set(['A', 'AAAA', 'CNAME', 'HTTPS', 'TXT', 'LOC', 'NS', 'SPF', 'CERT', 'DNSKEY', 'DS', 'NAPTR', 'SMIMEA', 'SSHFP', 'SVCB', 'TLSA']);

type SyncRecord = Record & {type: NonNullable<Record['type']>};

export type DdnsErrorCode = 'INVALID_CONFIG' | 'IP_UNAVAILABLE';

export class DdnsError extends Error {
  public constructor(
    public readonly code: DdnsErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DdnsError';
  }
}

export {SyncError};

export class Ddns {
  private readonly cloudflareClient: CloudflareClient;

  private readonly configuredRecords?: Array<Record>;

  private readonly zone?: string;

  private readonly resolveIp?: (family: 4 | 6) => string | Promise<string>;

  private readonly jobs = new Set<SyncJob>();

  private closed = false;

  public constructor(options: DdnsOptions = {}) {
    const {records, zone, resolveIp, ...auth} = options;
    this.cloudflareClient = new CloudflareClient(resolveAuth(auth));
    this.zone = normalizeZone(zone);
    this.resolveIp = resolveIp;
    this.configuredRecords = records === undefined ? undefined : normalizeRecords(records, this.zone);
  }

  public sync(): Promise<Array<DnsRecord>>;
  public sync(options: SyncOptions): Promise<Array<DnsRecord>>;
  public sync(records: RecordSelection, options?: SyncOptions): Promise<Array<DnsRecord>>;
  public sync(records: undefined, options: SyncOptions): Promise<Array<DnsRecord>>;
  public async sync(first?: RecordSelection | SyncOptions, second: SyncOptions = {}): Promise<Array<DnsRecord>> {
    this.ensureOpen();
    const {records, options} = getSyncArguments(first, second);
    validateSyncOptions(options);
    const selectedRecords = normalizeSyncRecords(this.resolveRecords(records));
    if (selectedRecords.length === 0) {
      return [];
    }

    return this.cloudflareClient.syncRecords(await this.withContent(selectedRecords, options));
  }

  public plan(): Promise<Array<SyncChange>>;
  public plan(options: SyncOptions): Promise<Array<SyncChange>>;
  public plan(records: RecordSelection, options?: SyncOptions): Promise<Array<SyncChange>>;
  public async plan(first?: RecordSelection | SyncOptions, second: SyncOptions = {}): Promise<Array<SyncChange>> {
    this.ensureOpen();
    const {records, options} = getSyncArguments(first, second);
    validateSyncOptions(options);
    const selectedRecords = normalizeSyncRecords(this.resolveRecords(records));
    if (selectedRecords.length === 0) {
      return [];
    }

    return this.cloudflareClient.planRecords(await this.withContent(selectedRecords, options));
  }

  public schedule(expression: string, options: JobOptions = {}): SyncJob {
    this.ensureOpen();
    const job = new ScheduledSyncJob(this, expression, copyJobOptions(options));
    this.jobs.add(job);
    return job;
  }

  public async watch(options: WatchOptions = {}): Promise<SyncJob> {
    this.ensureOpen();
    const copiedOptions = copyWatchOptions(options);
    const job = new WatchSyncJob(this, copiedOptions, this.dynamicFamilies(this.resolveRecords(copiedOptions.records), copiedOptions));
    await job.start();
    this.jobs.add(job);

    return job;
  }

  public list(): Promise<Array<DnsRecord>>;
  public list(filter: RecordListOptions): Promise<Array<DnsRecord>>;
  public list(filter: DomainListOptions): Promise<Array<DnsRecord>>;
  public list(filter: GroupedDomainListOptions): Promise<{[domain: string]: Array<DnsRecord>}>;
  public async list(filter: ListOptions = {}): Promise<Array<DnsRecord> | {[domain: string]: Array<DnsRecord>}> {
    this.ensureOpen();
    validateListFilter(filter);
    if ('domains' in filter && filter.domains !== undefined) {
      const domains = toArray(filter.domains);
      validateDomains(domains);
      const grouped = await this.cloudflareClient.getRecordDataForDomains(domains);

      return filter.groupBy === 'domain' ? grouped : Object.values(grouped).flat();
    }

    return this.cloudflareClient.getRecordDataForRecords(this.resolveRecords(filter.records));
  }

  public async remove(records: RecordSelection): Promise<void> {
    this.ensureOpen();
    const selectedRecords = normalizeRecords(records, this.zone);
    await Promise.all(selectedRecords.map((record) => this.cloudflareClient.removeRecordByNameAndType(record.name, record.type)));
  }

  public async ip(family: 4 | 6 = 4): Promise<string> {
    this.ensureOpen();
    if (family !== 4 && family !== 6) {
      throw invalidConfig('IP family must be 4 or 6.');
    }

    try {
      return this.resolveIp ? await this.resolveIp(family) : family === 4 ? await IPUtils.getIpv4() : await IPUtils.getIpv6();
    } catch (error) {
      throw new DdnsError('IP_UNAVAILABLE', `Could not determine the public IPv${family} address.`, error);
    }
  }

  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    await Promise.all([...this.jobs].map(async (job): Promise<void> => job.stop()));
    this.jobs.clear();
  }

  private resolveRecords(records?: RecordSelection): Array<Record> {
    const selectedRecords = records === undefined ? this.configuredRecords : normalizeRecords(records, this.zone);
    if (selectedRecords === undefined) {
      throw invalidConfig('Provide records when creating Ddns or when calling this method.');
    }

    return selectedRecords.map((record) => ({...record}));
  }

  private ensureOpen(): void {
    if (this.closed) {
      throw new DdnsError('INVALID_CONFIG', 'This Ddns instance is closed.');
    }
  }

  private dynamicFamilies(records: Array<Record>, options: SyncOptions): Array<4 | 6> {
    const families = new Set<4 | 6>();
    for (const record of records) {
      if (record.content) {
        continue;
      }
      if ((record.type === undefined || record.type === 'A') && options.ipv4 === undefined) {
        families.add(4);
      }
      if (record.type === 'AAAA' && options.ipv6 === undefined) {
        families.add(6);
      }
    }

    return [...families];
  }

  private async withContent(records: Array<SyncRecord>, options: SyncOptions): Promise<Array<SyncRecord>> {
    for (const record of records) {
      if (!record.content && record.type !== 'A' && record.type !== 'AAAA') {
        throw invalidConfig(`Record "${record.name}" of type ${record.type} requires content.`);
      }
    }

    const families = this.dynamicFamilies(records, options);
    const addresses = new Map<4 | 6, string>();
    await Promise.all(
      families.map(async (family): Promise<void> => {
        addresses.set(family, await this.ip(family));
      }),
    );

    const preparedRecords = records.map((record): SyncRecord => {
      if (record.content) {
        return record;
      }
      if (record.type === 'A') {
        return {...record, content: options.ipv4 ?? addresses.get(4)};
      }

      return {...record, content: options.ipv6 ?? addresses.get(6)};
    });

    for (const record of preparedRecords) {
      validatePreparedRecord(record);
    }

    return preparedRecords;
  }
}

export function createDdns(options: DdnsOptions = {}): Ddns {
  return new Ddns(options);
}

function normalizeRecords(records: RecordSelection, zone?: string): Array<Record> {
  return toArray(records).map((input, index): Record => {
    const record = typeof input === 'string' ? {name: input} : {...input};
    record.name = normalizeRecordName(record.name, zone);
    validateRecord(record, `records[${index}]`);

    return record;
  });
}

function normalizeZone(zone: string | undefined): string | undefined {
  if (zone === undefined) {
    return undefined;
  }
  if (typeof zone !== 'string' || zone.trim().length === 0) {
    throw invalidConfig('zone must be a non-empty domain.');
  }

  return zone.toLowerCase();
}

function normalizeRecordName(name: string, zone: string | undefined): string {
  if (!zone) {
    return name;
  }
  if (name === '@') {
    return zone;
  }
  if (!name.includes('.')) {
    return `${name}.${zone}`;
  }
  if (name === zone || name.endsWith(`.${zone}`)) {
    return name;
  }
  throw invalidConfig(`Record "${name}" is outside configured zone "${zone}".`);
}

function normalizeSyncRecords(records: Array<Record>): Array<SyncRecord> {
  return records.map((record): SyncRecord => ({...record, type: record.type ?? 'A'}));
}

function getSyncArguments(first: RecordSelection | SyncOptions | undefined, second: SyncOptions): {records?: RecordSelection; options: SyncOptions} {
  if (first === undefined) {
    return {options: second};
  }
  if (isSyncOptions(first)) {
    return {options: first};
  }

  return {records: first, options: second};
}

function isSyncOptions(value: RecordSelection | SyncOptions): value is SyncOptions {
  return !Array.isArray(value) && typeof value === 'object' && !('name' in value) && Object.keys(value).every((key) => key === 'ipv4' || key === 'ipv6');
}

function resolveAuth(auth: Auth): Auth {
  if (auth.token !== undefined || auth.key !== undefined || auth.email !== undefined) {
    if (auth.token && !auth.key) {
      return {token: auth.token};
    }
    if (auth.key?.startsWith('v1.0-') && !auth.token && !auth.email) {
      return {key: auth.key};
    }
    if (auth.key && auth.email && !auth.token) {
      return {email: auth.email, key: auth.key};
    }
    throw invalidConfig('Provide either a Cloudflare API token, an email and API key, or a User Service key.');
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw invalidConfig('Provide a Cloudflare API token or set CLOUDFLARE_API_TOKEN.');
  }

  return {token};
}

function validateRecord(record: Record, path: string): void {
  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    throw invalidConfig(`${path}.name must be a non-empty hostname.`);
  }
  if (record.type !== undefined && !recordTypes.has(record.type)) {
    throw invalidConfig(`${path}.type is not supported.`);
  }
  if (record.content !== undefined && (typeof record.content !== 'string' || record.content.trim().length === 0)) {
    throw invalidConfig(`${path}.content must be a non-empty string when provided.`);
  }
  if (record.ttl !== undefined && (!Number.isInteger(record.ttl) || record.ttl < 1)) {
    throw invalidConfig(`${path}.ttl must be a positive integer.`);
  }
  if (record.priority !== undefined && (!Number.isInteger(record.priority) || record.priority < 0)) {
    throw invalidConfig(`${path}.priority must be a non-negative integer.`);
  }
}

function validateSyncOptions(options: SyncOptions): void {
  if (options.ipv4 !== undefined && isIP(options.ipv4) !== 4) {
    throw invalidConfig('ipv4 must be a valid IPv4 address.');
  }
  if (options.ipv6 !== undefined && isIP(options.ipv6) !== 6) {
    throw invalidConfig('ipv6 must be a valid IPv6 address.');
  }
}

function validatePreparedRecord(record: Record): void {
  if (!record.content) {
    throw invalidConfig(`Record "${record.name}" is missing content.`);
  }
  if ((!record.type || record.type === 'A') && isIP(record.content) !== 4) {
    throw invalidConfig(`Record "${record.name}" requires an IPv4 address.`);
  }
  if (record.type === 'AAAA' && isIP(record.content) !== 6) {
    throw invalidConfig(`Record "${record.name}" requires an IPv6 address.`);
  }
}

function validateDomains(domains: Array<string>): void {
  for (const [index, domain] of domains.entries()) {
    if (typeof domain !== 'string' || domain.trim().length === 0) {
      throw invalidConfig(`domains[${index}] must be a non-empty domain.`);
    }
  }
}

function validateListFilter(filter: ListOptions): void {
  const hasRecords = 'records' in filter && filter.records !== undefined;
  const hasDomains = 'domains' in filter && filter.domains !== undefined;
  if (hasRecords && hasDomains) {
    throw invalidConfig('Use either records or domains when listing records.');
  }
  if (filter.groupBy !== undefined && !hasDomains) {
    throw invalidConfig('groupBy requires a domains filter.');
  }
  if (filter.groupBy !== undefined && filter.groupBy !== 'domain') {
    throw invalidConfig('groupBy must be "domain".');
  }
}

function copyJobOptions(options: JobOptions): JobOptions {
  validateSyncOptions(options);
  return {
    ...options,
    records: options.records === undefined ? undefined : normalizeRecords(options.records),
  };
}

function copyWatchOptions(options: WatchOptions): WatchOptions {
  const copied = copyJobOptions(options);
  const intervalMs = options.intervalMs ?? defaultWatchIntervalMs;
  if (!Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > maxTimerDelayMs) {
    throw invalidConfig(`intervalMs must be an integer between 1 and ${maxTimerDelayMs}.`);
  }

  return {...copied, intervalMs};
}

function toArray<T>(value: T | Array<T>): Array<T> {
  return Array.isArray(value) ? value : [value];
}

function invalidConfig(message: string): DdnsError {
  return new DdnsError('INVALID_CONFIG', message);
}

export * from './types/index.js';

export default createDdns;
