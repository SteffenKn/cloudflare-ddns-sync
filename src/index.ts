import CloudflareClient from './lib/cloudflare-client.js';
import Cron from './lib/cron.js';
import ipUtils from './lib/ip-utils.js';

import {Auth, MultiSyncCallback, Record} from './types/index.js';

export default class CloudflareDDNSSync {
  private cloudflareClient: CloudflareClient;

  constructor(auth: Auth) {
    this.cloudflareClient = new CloudflareClient(auth);
  }

  public getIp() {
    return ipUtils.getIpv4();
  }

  public getIpv6() {
    return ipUtils.getIpv6();
  }

  public getRecordDataForDomain(domain: string) {
    return this.cloudflareClient.getRecordsByDomain(domain);
  }

  public getRecordDataForDomains(domains: Array<string>) {
    return this.cloudflareClient.getRecordsByDomains(domains);
  }

  public getRecordDataForRecord(record: Record) {
    return this.cloudflareClient.getRecordDataForRecord(record);
  }

  public getRecordDataForRecords(records: Array<Record>) {
    return this.cloudflareClient.getRecordDataForRecords(records);
  }

  public removeRecord(recordName: string, recordType?: string) {
    return this.cloudflareClient.removeRecordByNameAndType(recordName, recordType);
  }

  public stopSyncOnIpChange(changeListenerId: string) {
    ipUtils.removeIpChangeListener(changeListenerId);
  }

  public syncByCronTime(cronExpression: string, records: Array<Record>, callback: MultiSyncCallback, ip?: string) {
    return Cron.createCronJob(cronExpression, async () => {
      const result = await this.syncRecords(records, ip);

      callback(result);
    });
  }

  public async syncOnIpChange(records: Array<Record>, callback: MultiSyncCallback) {
    const changeListenerId = await ipUtils.addIpChangeListener(async (ip: string) => {
      const result = await this.syncRecords(records, ip);

      callback(result);
    });

    // Sync records to make sure the current ip is already set.
    const currentIp = await ipUtils.getIpv4();
    this.syncRecords(records, currentIp).then((syncedRecords) => {
      callback(syncedRecords);
    });

    return changeListenerId;
  }

  public syncRecord(record: Record, ip?: string) {
    return this.cloudflareClient.syncRecord(record, ip) as any;
  }

  public syncRecords(records: Array<Record>, ip?: string) {
    return this.cloudflareClient.syncRecords(records, ip);
  }
}

export * from './types/index.js';
