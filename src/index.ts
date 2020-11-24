import {ScheduledTask} from 'node-cron';

import CloudflareClient from './lib/cloudflare-client';
import Cron from './lib/cron';
import ipUtils from './lib/ip-utils';

import {
  DomainRecordList,
  MultiSyncCallback,
  Record,
  RecordData,
} from './contracts/index';

export default class CloudflareDDNSSync {
  private cloudflareClient: CloudflareClient;

  constructor(email: string, authKey: string) {
    this.cloudflareClient = new CloudflareClient(email, authKey);
  }

  public getIp(): Promise<string> {
    return ipUtils.getIpv4();
  }

  public getIpv6(): Promise<string> {
    return ipUtils.getIpv6();
  }

  public async getRecordDataForDomain(domain: string): Promise<Array<RecordData>> {
    return this.cloudflareClient.getRecordDataForDomain(domain);
  }

  public async getRecordDataForDomains(domains: Array<string>): Promise<DomainRecordList> {
    return this.cloudflareClient.getRecordDataForDomains(domains);
  }

  public getRecordDataForRecord(record: Record): Promise<RecordData> {
    return this.cloudflareClient.getRecordDataForRecord(record);
  }

  public getRecordDataForRecords(records: Array<Record>): Promise<Array<RecordData>> {
    return this.cloudflareClient.getRecordDataForRecords(records);
  }

  public async removeRecord(recordName: string): Promise<void> {
    return this.cloudflareClient.removeRecordByName(recordName);
  }

  public stopSyncOnIpChange(changeListenerId: string): void {
    ipUtils.removeIpChangeListener(changeListenerId);
  }

  public syncByCronTime(cronExpression: string, records: Array<Record>, callback: MultiSyncCallback, ip?: string): ScheduledTask {
    return Cron.createCronJob(cronExpression, async(): Promise<void> => {
      const result: Array<RecordData> = await this.syncRecords(records, ip);

      callback(result);
    });
  }

  public async syncOnIpChange(records: Array<Record>, callback: MultiSyncCallback): Promise<string> {
    const changeListenerId: string = await ipUtils.addIpChangeListener(async(ip: string): Promise<void> => {
      const result: Array<RecordData> = await this.syncRecords(records, ip);

      callback(result);
    });

    // Sync records to make sure the current ip is already set.
    const currentIp: string = await ipUtils.getIpv4();
    this.syncRecords(records, currentIp).then((syncedRecords: Array<RecordData>): void => {
      callback(syncedRecords);
    });

    return changeListenerId;
  }

  public async syncRecord(record: Record, ip?: string): Promise<RecordData> {

    const ipToUse: string = ip ? ip : await ipUtils.getIp();

    return this.cloudflareClient.syncRecord(record, ipToUse);
  }

  public async syncRecords(records: Array<Record>, ip?: string): Promise<Array<RecordData>> {
    const currentIp: string = await ipUtils.getIp();

    const ipToUse: string = ip ? ip : currentIp;

    return this.cloudflareClient.syncRecords(records, ipToUse);
  }
}

export * from './contracts/index';
