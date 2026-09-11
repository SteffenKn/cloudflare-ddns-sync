import {ScheduledTask} from 'node-cron';

import {DnsRecord, JobOptions, RecordSelection, SyncJob, SyncOptions, WatchOptions} from '../types/index.js';
import Cron from './cron.js';

const defaultWatchIntervalMs = 10_000;

export type SyncJobOperations = {
  sync(records: RecordSelection | undefined, options: SyncOptions): Promise<Array<DnsRecord>>;
  ip(family: 4 | 6): Promise<string>;
};

abstract class BaseSyncJob implements SyncJob {
  private inFlight?: Promise<Array<DnsRecord>>;

  private callingCallback = false;

  public constructor(
    protected readonly operations: SyncJobOperations,
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
    const result = await this.operations.sync(this.options.records, options);
    this.callingCallback = true;
    try {
      await this.options.onSync?.(result);
    } finally {
      this.callingCallback = false;
    }

    return result;
  }
}

export class ScheduledSyncJob extends BaseSyncJob {
  private readonly task: ScheduledTask;

  private active = true;

  public constructor(operations: SyncJobOperations, expression: string, options: JobOptions) {
    super(operations, options);
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

export class WatchSyncJob extends BaseSyncJob {
  private timer?: NodeJS.Timeout;

  private active = false;

  private starting?: Promise<void>;

  private checking?: Promise<void>;

  private previousAddresses = new Map<4 | 6, string>();

  public constructor(
    operations: SyncJobOperations,
    private readonly watchOptions: WatchOptions,
    private readonly families: Array<4 | 6>,
  ) {
    super(operations, watchOptions);
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
      this.timer = setInterval((): void => {
        this.checkInBackground();
      }, this.watchOptions.intervalMs ?? defaultWatchIntervalMs);
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
        addresses.set(family, await this.operations.ip(family));
      }),
    );

    return addresses;
  }
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

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
