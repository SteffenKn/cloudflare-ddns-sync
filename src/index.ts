import {ScheduledTask} from 'node-cron';
import {isIP} from 'node:net';

import CloudflareClient from './lib/cloudflare-client.js';
import Cron from './lib/cron.js';
import IPUtils from './lib/ip-utils.js';
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
  SyncOptions,
  WatchOptions,
} from './types/index.js';

const defaultWatchIntervalMs = 10_000;
const maxTimerDelayMs = 2_147_483_647;
const recordTypes = new Set(['A', 'AAAA', 'CNAME', 'HTTPS', 'TXT', 'LOC', 'NS', 'SPF', 'CERT', 'DNSKEY', 'DS', 'NAPTR', 'SMIMEA', 'SSHFP', 'SVCB', 'TLSA']);

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

export class Ddns {
  private readonly cloudflareClient: CloudflareClient;

  private readonly configuredRecords?: Array<Record>;

  public constructor(options: DdnsOptions = {}) {
    const {records, ...auth} = options;
    this.cloudflareClient = new CloudflareClient(resolveAuth(auth));
    this.configuredRecords = records === undefined ? undefined : normalizeRecords(records);
  }

  public sync(): Promise<Array<DnsRecord>>;
  public sync(options: SyncOptions): Promise<Array<DnsRecord>>;
  public sync(records: RecordSelection, options?: SyncOptions): Promise<Array<DnsRecord>>;
  public sync(records: undefined, options: SyncOptions): Promise<Array<DnsRecord>>;
  public async sync(first?: RecordSelection | SyncOptions, second: SyncOptions = {}): Promise<Array<DnsRecord>> {
    const {records, options} = getSyncArguments(first, second);
    validateSyncOptions(options);
    const selectedRecords = this.resolveRecords(records);
    if (selectedRecords.length === 0) {
      return [];
    }

    return this.cloudflareClient.syncRecords(await this.withContent(selectedRecords, options));
  }

  public schedule(expression: string, options: JobOptions = {}): SyncJob {
    return new ScheduledSyncJob(this, expression, copyJobOptions(options));
  }

  public async watch(options: WatchOptions = {}): Promise<SyncJob> {
    const copiedOptions = copyWatchOptions(options);
    const job = new WatchSyncJob(this, copiedOptions, this.dynamicFamilies(copiedOptions.records, copiedOptions));
    await job.start();

    return job;
  }

  public list(): Promise<Array<DnsRecord>>;
  public list(filter: RecordListOptions): Promise<Array<DnsRecord>>;
  public list(filter: DomainListOptions): Promise<Array<DnsRecord>>;
  public list(filter: GroupedDomainListOptions): Promise<{[domain: string]: Array<DnsRecord>}>;
  public async list(filter: ListOptions = {}): Promise<Array<DnsRecord> | {[domain: string]: Array<DnsRecord>}> {
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
    const selectedRecords = normalizeRecords(records);
    await Promise.all(selectedRecords.map((record) => this.cloudflareClient.removeRecordByNameAndType(record.name, record.type)));
  }

  public async ip(family: 4 | 6 = 4): Promise<string> {
    if (family !== 4 && family !== 6) {
      throw invalidConfig('IP family must be 4 or 6.');
    }

    try {
      return family === 4 ? await IPUtils.getIpv4() : await IPUtils.getIpv6();
    } catch (error) {
      throw new DdnsError('IP_UNAVAILABLE', `Could not determine the public IPv${family} address.`, error);
    }
  }

  private resolveRecords(records?: RecordSelection): Array<Record> {
    const selectedRecords = records === undefined ? this.configuredRecords : normalizeRecords(records);
    if (selectedRecords === undefined) {
      throw invalidConfig('Provide records when creating Ddns or when calling this method.');
    }

    return selectedRecords.map((record) => ({...record}));
  }

  private dynamicFamilies(records: RecordSelection | undefined, options: SyncOptions): Array<4 | 6> {
    const families = new Set<4 | 6>();
    for (const record of this.resolveRecords(records)) {
      if (record.content) {
        continue;
      }
      if ((!record.type || record.type === 'A') && options.ipv4 === undefined) {
        families.add(4);
      }
      if (record.type === 'AAAA' && options.ipv6 === undefined) {
        families.add(6);
      }
    }

    return [...families];
  }

  private async withContent(records: Array<Record>, options: SyncOptions): Promise<Array<Record>> {
    for (const record of records) {
      if (!record.content && record.type && record.type !== 'A' && record.type !== 'AAAA') {
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

    const preparedRecords = records.map((record): Record => {
      if (record.content) {
        return record;
      }
      if (!record.type || record.type === 'A') {
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

abstract class BaseSyncJob implements SyncJob {
  private inFlight?: Promise<Array<DnsRecord>>;

  private callingCallback = false;

  public constructor(
    protected readonly ddns: Ddns,
    protected readonly options: JobOptions,
  ) {}

  public run(): Promise<Array<DnsRecord>> {
    return this.runWith(this.options);
  }

  public abstract start(): Promise<void>;

  public abstract stop(): Promise<void>;

  protected runInBackground(options: SyncOptions = this.options): void {
    void this.runWith(options).catch(async (error): Promise<void> => this.reportError(toError(error)));
  }

  protected runWith(options: SyncOptions): Promise<Array<DnsRecord>> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const run = this.perform(options);
    this.inFlight = run;
    void run
      .finally((): void => {
        if (this.inFlight === run) {
          this.inFlight = undefined;
        }
      })
      .catch((): void => undefined);

    return run;
  }

  protected async settle(): Promise<void> {
    if (!this.callingCallback) {
      await this.inFlight?.catch((): void => undefined);
    }
  }

  protected async reportError(error: Error): Promise<void> {
    try {
      if (this.options.onError) {
        await this.options.onError(error);
      } else {
        console.error(error);
      }
    } catch (callbackError) {
      console.error(toError(callbackError));
    }
  }

  private async perform(options: SyncOptions): Promise<Array<DnsRecord>> {
    const result = await this.ddns.sync(this.options.records, options);
    this.callingCallback = true;
    try {
      await this.options.onSync?.(result);
    } finally {
      this.callingCallback = false;
    }

    return result;
  }
}

class ScheduledSyncJob extends BaseSyncJob {
  private readonly task: ScheduledTask;

  private active = true;

  public constructor(ddns: Ddns, expression: string, options: JobOptions) {
    super(ddns, options);
    this.task = Cron.createCronJob(expression, (): void => {
      if (this.active) {
        this.runInBackground();
      }
    });
  }

  public async start(): Promise<void> {
    if (!this.active) {
      this.active = true;
      await this.task.start();
    }
  }

  public async stop(): Promise<void> {
    this.active = false;
    await this.task.stop();
    await this.settle();
  }
}

class WatchSyncJob extends BaseSyncJob {
  private timer?: NodeJS.Timeout;

  private active = false;

  private starting?: Promise<void>;

  private checking?: Promise<void>;

  private previousAddresses = new Map<4 | 6, string>();

  public constructor(
    ddns: Ddns,
    options: WatchOptions,
    private readonly families: Array<4 | 6>,
  ) {
    super(ddns, options);
  }

  public start(): Promise<void> {
    if (this.starting) {
      return this.starting;
    }
    if (this.active) {
      return Promise.resolve();
    }

    this.active = true;
    const start = this.startWatcher();
    this.starting = start;
    void start.finally((): void => {
      if (this.starting === start) {
        this.starting = undefined;
      }
    });

    return start;
  }

  public async stop(): Promise<void> {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.checking?.catch((): void => undefined);
    await this.settle();
  }

  private async startWatcher(): Promise<void> {
    const addresses = await this.currentAddresses();
    if (!this.active) {
      return;
    }
    await this.runWith({...this.options, ...addressesToOptions(addresses)});
    if (!this.active) {
      return;
    }

    this.previousAddresses = addresses;
    if (this.families.length > 0) {
      this.timer = setInterval(
        (): void => {
          this.checkInBackground();
        },
        (this.options as WatchOptions).intervalMs || defaultWatchIntervalMs,
      );
    }
  }

  private checkInBackground(): void {
    if (!this.active || this.checking) {
      return;
    }

    const check = this.checkForChanges();
    this.checking = check;
    void check
      .catch(async (error): Promise<void> => this.reportError(toError(error)))
      .finally((): void => {
        if (this.checking === check) {
          this.checking = undefined;
        }
      });
  }

  private async checkForChanges(): Promise<void> {
    const addresses = await this.currentAddresses();
    if (!this.active || !addressesChanged(this.previousAddresses, addresses)) {
      return;
    }

    await this.runWith({...this.options, ...addressesToOptions(addresses)});
    if (this.active) {
      this.previousAddresses = addresses;
    }
  }

  private async currentAddresses(): Promise<Map<4 | 6, string>> {
    const addresses = new Map<4 | 6, string>();
    await Promise.all(
      this.families.map(async (family): Promise<void> => {
        addresses.set(family, await this.ddns.ip(family));
      }),
    );

    return addresses;
  }
}

export function createDdns(options: DdnsOptions = {}): Ddns {
  return new Ddns(options);
}

function normalizeRecords(records: RecordSelection): Array<Record> {
  return toArray(records).map((input, index): Record => {
    const record = typeof input === 'string' ? {name: input} : {...input};
    validateRecord(record, `records[${index}]`);

    return record;
  });
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

function addressesToOptions(addresses: Map<4 | 6, string>): SyncOptions {
  const options: SyncOptions = {};
  const ipv4 = addresses.get(4);
  const ipv6 = addresses.get(6);
  if (ipv4) {
    options.ipv4 = ipv4;
  }
  if (ipv6) {
    options.ipv6 = ipv6;
  }

  return options;
}

function addressesChanged(previous: Map<4 | 6, string>, current: Map<4 | 6, string>): boolean {
  return previous.size !== current.size || [...current].some(([family, address]): boolean => previous.get(family) !== address);
}

function toArray<T>(value: T | Array<T>): Array<T> {
  return Array.isArray(value) ? value : [value];
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function invalidConfig(message: string): DdnsError {
  return new DdnsError('INVALID_CONFIG', message);
}

export * from './types/index.js';

export default createDdns;
