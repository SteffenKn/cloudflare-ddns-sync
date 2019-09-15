import Cloudflare from 'cloudflare';
import parseDomain from 'parse-domain';

import {DomainRecordList, Record, RecordData, ZoneData, ZoneMap} from '../contracts';
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

  public async syncRecord(record: Record, ip?: string): Promise<RecordData> {
    const recordIds: Map<string, string> = await this.getRecordIdsForRecords([record]);
    const ipToUse: string = ip ? ip : await IPUtils.getIp();

    const zoneId: string = await this.getZoneIdByRecordName(record.name);
    const recordId: string = recordIds.get(record.name.toLowerCase());

    const recordExists: boolean = recordId !== undefined;
    if (recordExists) {
      const result: RecordData = await this.updateRecord(zoneId, recordId, record, ipToUse);

      return result;
    } else {
      const result: RecordData = await this.createRecord(zoneId, record, ipToUse);

      return result;
    }
  }

  public async syncRecords(records: Array<Record>, ip?: string): Promise<Array<RecordData>> {
    const recordIds: Map<string, string> = await this.getRecordIdsForRecords(records);
    const ipToUse: string = ip ? ip : await IPUtils.getIp();

    const resultPromises: Array<Promise<RecordData>> = records.map(async(record: Record) => {
      const zoneId: string = await this.getZoneIdByRecordName(record.name);
      const recordId: string = recordIds.get(record.name.toLowerCase());

      const recordExists: boolean = recordId !== undefined;
      if (recordExists) {
        const currentResult: RecordData = await this.updateRecord(zoneId, recordId, record, ipToUse);

        return currentResult;
      } else {
        const currentResult: RecordData = await this.createRecord(zoneId, record, ipToUse);

        return currentResult;
      }

    });

    const results: Array<RecordData> = await Promise.all(resultPromises);

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
    const record: RecordData = await this.getRecordByName(recordName);

    return record.id;
  }

  // TODO: Performance?
  public async getRecordDataForRecord(record: Record): Promise<RecordData> {
    // console.time('getRecordDataForRecord');
    const domain: string = this.getDomainByRecordName(record.name);

    const recordDataForDomain: Array<RecordData> = await this.getRecordsByDomain(domain);

    const recordData: RecordData = recordDataForDomain.find((singleRecordData: RecordData) => {
        return record.name.toLowerCase() === singleRecordData.name.toLowerCase();
      });

    // console.timeEnd('getRecordDataForRecord');
    return recordData;
  }

  // TODO: Performance?
  public async getRecordDataForRecords(records: Array<Record>): Promise<Array<RecordData>> {
    // console.time('getRecordDataForRecords');
    const domains: Array<string> = this.getDomainsFromRecords(records);

    const recordDataPromises: Array<Promise<Array<RecordData>>> = domains.map(async(domain: string) => {
      const recordDataForDomain: Array<RecordData> = await this.getRecordsByDomain(domain);

      const recordDataForDomainFilteredByRecords: Array<RecordData> = recordDataForDomain.filter((singleRecordData: RecordData) => {
        return records.some((record: Record) => {
          return record.name.toLowerCase() === singleRecordData.name.toLowerCase();
        });
      });

      return recordDataForDomainFilteredByRecords;
    });

    const recordDataForDomains: Array<Array<RecordData>> = await Promise.all(recordDataPromises);
    const recordData: Array<RecordData> = [].concat(...recordDataForDomains);

    // console.timeEnd('getRecordDataForRecords');
    return recordData;
  }

  // TODO: Performance?
  public async getRecordDataForDomains(domains: Array<string>): Promise<DomainRecordList> {
    // console.time('getRecordDataForDomains');

    const recordDataPromises: Array<Promise<Array<RecordData>>> = domains.map(async(domain: string) => {
      return this.getRecordDataForDomain(domain);
    });

    const recordDataForDomains: Array<Array<RecordData>> = await Promise.all(recordDataPromises);

    const recordData: DomainRecordList = {};
    recordDataForDomains.forEach((recordDataForDomain: Array<RecordData>, index: number): void => {
      recordData[domains[index]] = recordDataForDomain;
    });

    // console.timeEnd('getRecordDataForDomains');
    return recordData;
  }

  // TODO: Performance?
  public async getRecordDataForDomain(domain: string): Promise<Array<RecordData>> {
    // console.time('getRecordDataForDomain');
    const recordData: Array<RecordData> =  await this.getRecordsByDomain(domain);
    // console.timeEnd('getRecordDataForDomain');

    return recordData;
  }

  private async createRecord(zoneId: string, record: Record, ip?: string): Promise<RecordData> {
    const copyOfRecord: Record = Object.assign({}, record);
    copyOfRecord.name = record.name.toLowerCase();
    copyOfRecord.content = copyOfRecord.content ? copyOfRecord.content : ip;
    copyOfRecord.type = copyOfRecord.type ? copyOfRecord.type : 'A';

    if (!copyOfRecord.content) {
      throw Error(`Could not create Record "${copyOfRecord.name}": Ip is missing!`);
    }

    try {
      const response: Response & {result: RecordData} = await this.cloudflare.dnsRecords.add(zoneId, copyOfRecord);

      return response.result;
    } catch (error) {
      throw error;
    }
  }

  private async updateRecord(zoneId: string, recordId: string, record: Record, ip?: string): Promise<RecordData> {
    const copyOfRecord: Record = Object.assign({}, record);
    copyOfRecord.name = record.name.toLowerCase();
    copyOfRecord.content = copyOfRecord.content ? copyOfRecord.content : ip;
    copyOfRecord.type = copyOfRecord.type ? copyOfRecord.type : 'A';

    if (!copyOfRecord.content) {
      throw Error(`Could not update Record "${record.name}": Ip is missing!`);
    }

    try {
      const response: Response & {result: RecordData} = await this.cloudflare.dnsRecords.edit(zoneId, recordId, copyOfRecord);

      return response.result;
    } catch (error) {
      throw error;
    }
  }

  private async updateZoneMap(): Promise<void> {
    const response: {result: Array<ZoneData>} = await this.cloudflare.zones.browse();
    const zones: Array<ZoneData> = response.result;

    this.zoneMap = new Map();
    for (const zone of zones) {
      this.zoneMap.set(zone.name, zone.id);
    }
  }

  private async getRecordByName(recordName: string): Promise<RecordData> {
    const domain: string = this.getDomainByRecordName(recordName);

    const records: Array<RecordData> = await this.getRecordsByDomain(domain);

    const record: RecordData = records.find((currentRecord: RecordData) => {
      return currentRecord.name.toLowerCase() === recordName.toLowerCase();
    });

    const recordNotFound: boolean = record === undefined;
    if (recordNotFound) {
      throw new Error(`Record '${recordName}' not found.`);
    }

    return record;
  }

  // TODO: Performance?
  private async getRecordIdsForRecords(records: Array<Record>): Promise<Map<string, string>> {
    // console.time('getRecordIdsToUpdate');

    const recordIdMap: Map<string, string> = new Map();

    const recordData: Array<RecordData> = await this.getRecordDataForRecords(records);

    for (const record of recordData) {
      recordIdMap.set(record.name.toLowerCase(), record.id);
    }

    // console.timeEnd('getRecordIdsToUpdate');

    return recordIdMap;
  }

  private async getRecordsByDomain(domain: string): Promise<Array<RecordData>> {
    const zoneId: string = await this.getZoneIdByDomain(domain);

    const records: Array<RecordData>  = [];

    let pageIndex: number = 1;
    let allRecordsFound: boolean = false;
    while (!allRecordsFound) {
      const response: Response & {result: Array<RecordData>} = await this.cloudflare.dnsRecords.browse(zoneId, {
        page: pageIndex,
        per_page: 100,
      });

      records.push(...response.result);

      allRecordsFound = response.result.length < 100;

      pageIndex++;
    }

    return records;
  }

  private async getZoneIdByDomain(domain: string): Promise<string> {
    if (this.zoneMap.has(domain)) {
      const zoneId: string = this.zoneMap.get(domain.toLowerCase());

      return zoneId;
    } else {
      await this.updateZoneMap();
      const zoneId: string = this.zoneMap.get(domain.toLowerCase());

      return zoneId;
    }
  }

  private getDomainsFromRecords(records: Array<Record>): Array<string> {
    const domains: Array<string> = records.map((record: Record) => {
      return this.getDomainByRecordName(record.name);
    }).filter((domain: string, index: number, domainList: Array<string>) => {
      return domainList.indexOf(domain.toLowerCase()) === index;
    });

    return domains;
  }

  private getDomainByRecordName(recordName: string): string {
    const parsedDomain: parseDomain.ParsedDomain = parseDomain(recordName);

    return `${parsedDomain.domain}.${parsedDomain.tld}`.toLowerCase();
  }
}
