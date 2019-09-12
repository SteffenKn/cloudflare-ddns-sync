import Cloudflare from 'cloudflare';
import parseDomain from 'parse-domain';

import {IRecord, Record, Zone, ZoneMap} from '../contracts';
import IPUtils from './ip-utils';

export default class CloudflareClient {
  private cloudflare: Cloudflare;

  private zoneMap: ZoneMap = new Map();

  constructor(email: string, authKey: string) {
    this.cloudflare = new Cloudflare({
      email: email,
      key: authKey,
    });

    this.updateZoneMap();
  }

  public async syncRecord(record: IRecord, ip?: string): Promise<Record> {
    const recordIds: Map<string, string> = await this.getRecordIdsForRecords([record]);
    const ipToUse: string = ip ? ip : await IPUtils.getIp();

    const zoneId: string = await this.getZoneIdByRecordName(record.name);
    const recordId: string = recordIds.get(record.name);

    const recordExists: boolean = recordId !== undefined;
    if (recordExists) {
      const result: Record = await this.updateRecord(zoneId, recordId, record, ipToUse);

      return result;
    } else {
      const result: Record = await this.createRecord(zoneId, record, ipToUse);

      return result;
    }
  }

  public async syncRecords(records: Array<IRecord>, ip?: string): Promise<Array<Record>> {
    const recordIds: Map<string, string> = await this.getRecordIdsForRecords(records);
    const ipToUse: string = ip ? ip : await IPUtils.getIp();

    const resultPromises: Array<Promise<Record>> = records.map(async(record: IRecord) => {
      const zoneId: string = await this.getZoneIdByRecordName(record.name);
      const recordId: string = recordIds.get(record.name);

      const recordExists: boolean = recordId !== undefined;
      if (recordExists) {
        const currentResult: Record = await this.updateRecord(zoneId, recordId, record, ipToUse);

        return currentResult;
      } else {
        const currentResult: Record = await this.createRecord(zoneId, record, ipToUse);

        return currentResult;
      }

    });

    const results: Array<Record> = await Promise.all(resultPromises);

    return results;
  }

  public async removeRecord(zoneId: string, recordId: string): Promise<void> {
    try {
      await this.cloudflare.dnsRecords.del(zoneId, recordId);
    } catch (error) {
      throw error;
    }
  }

  public async getZoneIdByRecordName(recordName: string): Promise<string> {
    const domain: string = this.getDomainByRecordName(recordName);

    return this.getZoneIdByDomain(domain);
  }

  public async getRecordIdByName(recordName: string): Promise<string> {
    const record: Record = await this.getRecordByName(recordName);

    return record.id;
  }

  // TODO: Performance?
  public async getRecordDataForRecord(record: IRecord): Promise<Record> {
    // console.time('getRecordDataForRecord');
    const domain: string = this.getDomainByRecordName(record.name);

    const recordDataForDomain: Array<Record> = await this.getRecordsByDomain(domain);

    const recordData: Record = recordDataForDomain.find((singleRecordData: Record) => {
        return record.name === singleRecordData.name;
      });

    // console.timeEnd('getRecordDataForRecord');
    return recordData;
  }

  // TODO: Performance?
  public async getRecordDataForRecords(records: Array<IRecord>): Promise<Array<Record>> {
    // console.time('getRecordDataForRecords');
    const domains: Array<string> = this.getDomainsFromRecords(records);

    const recordDataPromises: Array<Promise<Array<Record>>> = domains.map(async(domain: string) => {
      const recordDataForDomain: Array<Record> = await this.getRecordsByDomain(domain);

      const recordDataForDomainFilteredByRecords: Array<Record> = recordDataForDomain.filter((singleRecordData: Record) => {
        return records.some((record: IRecord) => {
          return record.name === singleRecordData.name;
        });
      });

      return recordDataForDomainFilteredByRecords;
    });

    const recordDataForDomains: Array<Array<Record>> = await Promise.all(recordDataPromises);
    const recordData: Array<Record> = [].concat(...recordDataForDomains);

    // console.timeEnd('getRecordDataForRecords');
    return recordData;
  }

  private async createRecord(zoneId: string, record: IRecord, ip?: string): Promise<Record> {
    const copyOfRecord: IRecord = Object.assign({}, record);
    copyOfRecord.content = copyOfRecord.content ? copyOfRecord.content : ip;
    copyOfRecord.type = copyOfRecord.type ? copyOfRecord.type : 'A';

    if (!copyOfRecord.content) {
      throw Error(`Could not create Record "${record.name}": Ip is missing!`);
    }

    try {
      const response: {result: Record} = await this.cloudflare.dnsRecords.add(zoneId, copyOfRecord);

      return response.result;
    } catch (error) {
      throw error;
    }
  }

  private async updateRecord(zoneId: string, recordId: string, record: IRecord, ip?: string): Promise<Record> {
    const copyOfRecord: IRecord = Object.assign({}, record);
    copyOfRecord.content = copyOfRecord.content ? copyOfRecord.content : ip;
    copyOfRecord.type = copyOfRecord.type ? copyOfRecord.type : 'A';

    if (!copyOfRecord.content) {
      throw Error(`Could not update Record "${record.name}": Ip is missing!`);
    }

    try {
      const response: {result: Record} = await this.cloudflare.dnsRecords.edit(zoneId, recordId, copyOfRecord);

      return response.result;
    } catch (error) {
      throw error;
    }
  }

  private async updateZoneMap(): Promise<void> {
    const response: {result: Array<Zone>} = await this.cloudflare.zones.browse();
    const zones: Array<Zone> = response.result;

    this.zoneMap = new Map();
    for (const zone of zones) {
      this.zoneMap.set(zone.name, zone.id);
    }
  }

  private async getRecordByName(recordName: string): Promise<Record> {
    const domain: string = this.getDomainByRecordName(recordName);

    const records: Array<Record> = await this.getRecordsByDomain(domain);

    const record: Record = records.find((currentRecord: Record) => {
      return currentRecord.name === recordName;
    });

    const recordNotFound: boolean = record === undefined;
    if (recordNotFound) {
      throw new Error(`Record '${recordName}' not found.`);
    }

    return record;
  }

  // TODO: Performance?
  private async getRecordIdsForRecords(records: Array<IRecord>): Promise<Map<string, string>> {
    // console.time('getRecordIdsToUpdate');

    const recordIdMap: Map<string, string> = new Map();

    const recordData: Array<Record> = await this.getRecordDataForRecords(records);

    for (const record of recordData) {
      recordIdMap.set(record.name, record.id);
    }

    // console.timeEnd('getRecordIdsToUpdate');

    return recordIdMap;
  }

  private async getRecordsByDomain(domain: string): Promise<Array<Record>> {
    const zoneId: string = await this.getZoneIdByDomain(domain);

    const response: {result: Array<Record>} = await this.cloudflare.dnsRecords.browse(zoneId);
    const records: Array<Record> = response.result;

    return records;
  }

  private async getZoneIdByDomain(domain: string): Promise<string> {
    if (this.zoneMap.has(domain)) {
      const zoneId: string = this.zoneMap.get(domain);

      return zoneId;
    } else {
      await this.updateZoneMap();
      const zoneId: string = this.zoneMap.get(domain);

      return zoneId;
    }
  }

  private getDomainsFromRecords(records: Array<IRecord>): Array<string> {
    const domains: Array<string> = records.map((record: IRecord) => {
      return this.getDomainByRecordName(record.name);
    }).filter((domain: string, index: number, domainList: Array<string>) => {
      return domainList.indexOf(domain) === index;
    });

    return domains;
  }

  private getDomainByRecordName(recordName: string): string {
    const parsedDomain: parseDomain.ParsedDomain = parseDomain(recordName);

    return `${parsedDomain.domain}.${parsedDomain.tld}`;
  }
}
