import {ScheduledTask} from 'node-cron';

import CloudflareClient from './lib/cloudflare-client';
import Cron from './lib/cron';
import ipUtils from './lib/ip-utils';

import {
  IRecord,
  Record,
  MultiSyncCallback,
  MultiSyncResult,
  SingleSyncResult,
} from './contracts/index';

export default class CloudflareDDNSSync {
  public cloudflareClient: CloudflareClient;

  constructor(email: string, authKey: string) {
    this.cloudflareClient = new CloudflareClient(email, authKey);
  }

  public getRecordDataForRecords(records: Array<IRecord>): Promise<Array<Record>> {
    return this.cloudflareClient.getRecordDataForRecords(records);
  }

  public getIp(): Promise<string> {
    return ipUtils.getIp();
  }

  public async createRecord(record: IRecord): Promise<IRecord> {
    return this.cloudflareClient.syncRecord(record);
  }

  public async removeRecord(recordName: string): Promise<void> {
    const zoneId: string = await this.cloudflareClient.getZoneIdByRecordName(recordName);
    const recordId: string = await this.cloudflareClient.getRecordIdByName(recordName);


    this.cloudflareClient.removeRecord(zoneId, recordId);
  }

  public async sync(record: IRecord, ip?: string): SingleSyncResult {

    const ipToUse: string = ip ? ip : await ipUtils.getIp();

    return this.cloudflareClient.syncRecord(record, ipToUse);
  }

  public async syncRecords(records: Array<IRecord>, ip?: string): MultiSyncResult {
    const currentIp: string = await ipUtils.getIp();

    const ipToUse: string = ip ? ip : currentIp;

    return this.cloudflareClient.syncRecords(records, ipToUse);
  }

  public async syncOnIpChange(records: Array<IRecord>, callback: MultiSyncCallback): Promise<string> {
    const changeListenerId: string = await ipUtils.addIpChangeListener(async(ip: string) => {
      const result = await this.syncRecords(records, ip);
  
      callback(result);
    });

    const currentIp: string = await ipUtils.getIp();
    this.syncRecords(records, currentIp).then((records: Array<Record>) => {
      callback(records);
    });

    return changeListenerId
  }

  public stopSyncOnIpChange(changeListenerId: string): void {
    ipUtils.removeIpChangeListener(changeListenerId);
  }

  public syncByCronTime(cronExpression: string, records: Array<IRecord>, callback: MultiSyncCallback, ip?: string): ScheduledTask {
    return Cron.createCronJob(cronExpression, async() => {
      const result: Array<Record> = await this.syncRecords(records, ip);

      callback(result);
    })
  }
}

module.exports = CloudflareDDNSSync;
