import {ScheduledTask} from 'node-cron';

import CloudflareClient from './lib/cloudflare-client.js';
import Cron from './lib/cron.js';
import IPUtils from './lib/ip-utils.js';
import {Auth, DdnsOptions, DnsRecord, JobOptions, ListOptions, Record, RecordSelection, SyncJob, SyncOptions, WatchOptions} from './types/index.js';

const defaultWatchIntervalMs = 10_000;

export class Ddns {
  private readonly cloudflareClient: CloudflareClient;

  private readonly configuredRecords?: Array<Record>;

  public constructor(options: DdnsOptions = {}) {
    const {records, ...auth} = options;
    this.cloudflareClient = new CloudflareClient(resolveAuth(auth));
    this.configuredRecords = records === undefined ? undefined : normalizeRecords(records);
  }

  public async sync(records?: RecordSelection, options: SyncOptions = {}): Promise<Array<DnsRecord>> {
    const selectedRecords = this.resolveRecords(records);
    if (selectedRecords.length === 0) {
      return [];
    }

    return this.cloudflareClient.syncRecords(await this.withContent(selectedRecords, options));
  }

  public schedule(expression: string, options: JobOptions = {}): SyncJob {
    return new ScheduledSyncJob(this, expression, options);
  }

  public async watch(options: WatchOptions = {}): Promise<SyncJob> {
    const job = new WatchSyncJob(this, options);
    await job.start();

    return job;
  }

  public async list(filter: ListOptions = {}): Promise<Array<DnsRecord> | {[domain: string]: Array<DnsRecord>}> {
    if (filter.records !== undefined && filter.domains !== undefined) {
      throw new Error('Use either records or domains when listing DNS records.');
    }
    if (filter.groupBy === 'domain' && filter.records !== undefined) {
      throw new Error('Grouping by domain requires a domain filter.');
    }

    if (filter.domains !== undefined) {
      const domains = toArray(filter.domains);
      const grouped = await this.cloudflareClient.getRecordDataForDomains(domains);

      return filter.groupBy === 'domain' ? grouped : Object.values(grouped).flat();
    }

    return this.cloudflareClient.getRecordDataForRecords(this.resolveRecords(filter.records));
  }

  public async remove(records: RecordSelection): Promise<void> {
    await Promise.all(normalizeRecords(records).map((record) => this.cloudflareClient.removeRecordByNameAndType(record.name, record.type)));
  }

  public ip(family: 4 | 6 = 4): Promise<string> {
    return family === 4 ? IPUtils.getIpv4() : IPUtils.getIpv6();
  }

  public dynamicFamilies(records?: RecordSelection): Array<4 | 6> {
    const families = new Set<4 | 6>();
    for (const record of this.resolveRecords(records)) {
      if (record.content) {
        continue;
      }
      if (!record.type || record.type === 'A') {
        families.add(4);
      } else if (record.type === 'AAAA') {
        families.add(6);
      }
    }

    return [...families];
  }

  private resolveRecords(records?: RecordSelection): Array<Record> {
    const selectedRecords = records === undefined ? this.configuredRecords : normalizeRecords(records);
    if (selectedRecords === undefined) {
      throw new Error('Provide records when creating Ddns or when calling this method.');
    }

    return selectedRecords.map((record) => ({...record}));
  }

  private async withContent(records: Array<Record>, options: SyncOptions): Promise<Array<Record>> {
    const families = this.dynamicFamilies(records);
    const addresses = new Map<4 | 6, string>();
    if (families.includes(4)) {
      addresses.set(4, options.ipv4 || (await this.ip(4)));
    }
    if (families.includes(6)) {
      addresses.set(6, options.ipv6 || (await this.ip(6)));
    }

    return records.map((record): Record => {
      if (record.content) {
        return record;
      }
      if (!record.type || record.type === 'A') {
        return {...record, content: addresses.get(4)};
      }
      if (record.type === 'AAAA') {
        return {...record, content: addresses.get(6)};
      }

      throw new Error(`Record "${record.name}" of type ${record.type} requires content.`);
    });
  }
}

abstract class BaseSyncJob implements SyncJob {
  private inFlight?: Promise<Array<DnsRecord>>;

  public constructor(
    protected readonly ddns: Ddns,
    protected readonly options: JobOptions,
  ) {}

  public run(): Promise<Array<DnsRecord>> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const run = this.perform();
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

  public abstract start(): Promise<void>;

  public abstract stop(): Promise<void>;

  protected async settle(): Promise<void> {
    await this.inFlight?.catch((): void => undefined);
  }

  private async perform(): Promise<Array<DnsRecord>> {
    try {
      const result = await this.ddns.sync(this.options.records, this.options);
      await this.options.onSync?.(result);

      return result;
    } catch (error) {
      await this.reportError(toError(error));
      throw error;
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
}

class ScheduledSyncJob extends BaseSyncJob {
  private readonly task: ScheduledTask;

  public constructor(ddns: Ddns, expression: string, options: JobOptions) {
    super(ddns, options);
    this.task = Cron.createCronJob(expression, (): void => {
      void this.run().catch((): void => undefined);
    });
  }

  public async start(): Promise<void> {
    await this.task.start();
  }

  public async stop(): Promise<void> {
    await this.task.stop();
    await this.settle();
  }
}

class WatchSyncJob extends BaseSyncJob {
  private timer?: NodeJS.Timeout;

  private previousAddresses = new Map<4 | 6, string>();

  public constructor(
    ddns: Ddns,
    private readonly watchOptions: WatchOptions,
  ) {
    super(ddns, watchOptions);
  }

  public async start(): Promise<void> {
    if (this.timer) {
      return;
    }

    await this.run();
    this.previousAddresses = await this.currentAddresses();
    if (this.previousAddresses.size > 0) {
      this.timer = setInterval((): void => {
        void this.checkForChanges();
      }, this.watchOptions.intervalMs || defaultWatchIntervalMs);
    }
  }

  public async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.settle();
  }

  private async checkForChanges(): Promise<void> {
    try {
      const currentAddresses = await this.currentAddresses();
      const changed = [...currentAddresses].some(([family, address]): boolean => this.previousAddresses.get(family) !== address);
      if (changed) {
        await this.run();
        this.previousAddresses = currentAddresses;
      }
    } catch (error) {
      await this.reportError(toError(error));
    }
  }

  private async currentAddresses(): Promise<Map<4 | 6, string>> {
    const addresses = new Map<4 | 6, string>();
    await Promise.all(
      this.ddns.dynamicFamilies(this.options.records).map(async (family): Promise<void> => {
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
  return toArray(records).map((record): Record => (typeof record === 'string' ? {name: record} : {...record}));
}

function resolveAuth(auth: Auth): Auth {
  if (auth.token || auth.key || auth.email) {
    if (auth.key || auth.token) {
      return auth;
    }
    throw new Error('Provide a Cloudflare API token or an email and API key.');
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error('Provide a Cloudflare API token or set CLOUDFLARE_API_TOKEN.');
  }

  return {token};
}

function toArray<T>(value: T | Array<T>): Array<T> {
  return Array.isArray(value) ? value : [value];
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export * from './types/index.js';

export default createDdns;
