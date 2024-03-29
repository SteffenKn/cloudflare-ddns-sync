import {ScheduledTask} from 'node-cron';

import CloudflareClient from './lib/cloudflare-client.js';
import Cron from './lib/cron.js';
import ipUtils from './lib/ip-utils.js';

import {Auth, DomainRecordList, MultiSyncCallback, Record, RecordData} from './types/index.js';

export default class CloudflareDDNSSync {
  private cloudflareClient: CloudflareClient;

  constructor(auth: Auth) {
    this.cloudflareClient = new CloudflareClient(auth);
  }

  public getIp(): Promise<string> {
    return ipUtils.getIpv4();
  }

  public getIpv6(): Promise<string> {
    return ipUtils.getIpv6();
  }

  public getRecordDataForDomain(domain: string): Promise<Array<RecordData>> {
    return this.cloudflareClient.getRecordDataForDomain(domain);
  }

  public getRecordDataForDomains(domains: Array<string>): Promise<DomainRecordList> {
    return this.cloudflareClient.getRecordDataForDomains(domains);
  }

  public getRecordDataForRecord(record: Record): Promise<RecordData> {
    return this.cloudflareClient.getRecordDataForRecord(record);
  }

  public getRecordDataForRecords(records: Array<Record>): Promise<Array<RecordData>> {
    return this.cloudflareClient.getRecordDataForRecords(records);
  }

  public removeRecord(recordName: string, recordType?: string): Promise<void> {
    return this.cloudflareClient.removeRecordByNameAndType(recordName, recordType);
  }

  public stopSyncOnIpChange(changeListenerId: string): void {
    ipUtils.removeIpChangeListener(changeListenerId);
  }

  public syncByCronTime(cronExpression: string, records: Array<Record>, callback: MultiSyncCallback, ip?: string): ScheduledTask {
    return Cron.createCronJob(cronExpression, async (): Promise<void> => {
      const result: Array<RecordData> = await this.syncRecords(records, ip);

      callback(result);
    });
  }

  public async syncOnIpChange(records: Array<Record>, callback: MultiSyncCallback): Promise<string> {
    const changeListenerId = await ipUtils.addIpChangeListener(async (ip: string): Promise<void> => {
      const result: Array<RecordData> = await this.syncRecords(records, ip);

      callback(result);
    });

    // Sync records to make sure the current ip is already set.
    const currentIp = await ipUtils.getIpv4();
    this.syncRecords(records, currentIp).then((syncedRecords: Array<RecordData>): void => {
      callback(syncedRecords);
    });

    return changeListenerId;
  }

  public syncRecord(record: Record, ip?: string): Promise<RecordData> {
    return this.cloudflareClient.syncRecord(record, ip);
  }

  public syncRecords(records: Array<Record>, ip?: string): Promise<Array<RecordData>> {
    return this.cloudflareClient.syncRecords(records, ip);
  }
}

export * from './types/index.js';
