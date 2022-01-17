import {
  ParseResult,
  ParseResultType,
  fromUrl,
  parseDomain,
} from 'parse-domain';
import Cloudflare from 'cloudflare';

import {DomainRecordList, Record, RecordData, ZoneData, ZoneMap} from '../contracts';
import IPUtils from './ip-utils';

const ipv4Regex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/u;
// eslint-disable-next-line max-len
const ipv6Regex = /^(?:(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){6})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:::(?:(?:(?:[0-9a-fA-F]{1,4})):){5})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){4})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,1}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){3})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,2}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){2})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,3}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:[0-9a-fA-F]{1,4})):)(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,4}(?:(?:[0-9a-fA-F]{1,4})))?::)(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,5}(?:(?:[0-9a-fA-F]{1,4})))?::)(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,6}(?:(?:[0-9a-fA-F]{1,4})))?::))))$/u;

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
    const ipToUse: string = ip ? ip : await IPUtils.getIpv4();

    const zoneId: string = await this.getZoneIdByRecordName(record.name);
    const recordId: string = recordIds.get(this.getRecordIdMapKey(record));

    const recordExists: boolean = recordId !== undefined;
    if (recordExists) {
      const result: RecordData = await this.updateRecord(zoneId, recordId, record, ipToUse);

      return result;
    }
    const result: RecordData = await this.createRecord(zoneId, record, ipToUse);

    return result;
  }

  public async syncRecords(records: Array<Record>, ip?: string): Promise<Array<RecordData>> {
    const recordIds: Map<string, string> = await this.getRecordIdsForRecords(records);
    const ipToUse: string = ip ? ip : await IPUtils.getIpv4();

    const resultPromises: Array<Promise<RecordData>> = records.map(async(record: Record): Promise<RecordData> => {
      const zoneId: string = await this.getZoneIdByRecordName(record.name);
      const recordId: string = recordIds.get(this.getRecordIdMapKey(record));

      const recordExists: boolean = recordId !== undefined;
      if (recordExists) {
        const currentResult: RecordData = await this.updateRecord(zoneId, recordId, record, ipToUse);

        return currentResult;
      }
      const currentResult: RecordData = await this.createRecord(zoneId, record, ipToUse);

      return currentResult;
    });

    const results: Array<RecordData> = await Promise.all(resultPromises);

    return results;
  }

  public async removeRecordByNameAndType(recordName: string, recordType?: string): Promise<void> {
    const recordTypeToUse: string = recordType ? recordType : 'A';

    const zoneId: string = await this.getZoneIdByRecordName(recordName);
    const recordId: string = await this.getRecordIdByNameAndType(recordName, recordTypeToUse);

    return this.cloudflare.dnsRecords.del(zoneId, recordId);
  }

  public async getRecordDataForRecord(record: Record): Promise<RecordData> {
    const domain: string = this.getDomainByRecordName(record.name);

    const recordDataForDomain: Array<RecordData> = await this.getRecordsByDomain(domain);

    const recordData: RecordData
      = recordDataForDomain.find((singleRecordData: RecordData): boolean => record.name.toLowerCase() === singleRecordData.name.toLowerCase());

    return recordData;
  }

  public async getRecordDataForRecords(records: Array<Record>): Promise<Array<RecordData>> {
    const domains: Array<string> = this.getDomainsFromRecords(records);

    const recordDataPromises: Array<Promise<Array<RecordData>>> = domains.map(async(domain: string): Promise<Array<RecordData>> => {
      const recordDataForDomain: Array<RecordData> = await this.getRecordsByDomain(domain);

      const recordDataForDomainFilteredByRecords: Array<RecordData>
        = recordDataForDomain
          .filter((singleRecordData: RecordData): boolean => records
            .some((record: Record): boolean => record.name.toLowerCase() === singleRecordData.name.toLowerCase()));

      return recordDataForDomainFilteredByRecords;
    });

    const recordDataForDomains: Array<Array<RecordData>> = await Promise.all(recordDataPromises);
    const recordData: Array<RecordData> = [].concat(...recordDataForDomains);

    return recordData;
  }

  public async getRecordDataForDomains(domains: Array<string>): Promise<DomainRecordList> {
    const recordDataPromises: Array<Promise<Array<RecordData>>>
     = domains.map((domain: string): Promise<Array<RecordData>> => this.getRecordDataForDomain(domain));

    const recordDataForDomains: Array<Array<RecordData>> = await Promise.all(recordDataPromises);

    const recordData: DomainRecordList = {};
    recordDataForDomains.forEach((recordDataForDomain: Array<RecordData>, index: number): void => {
      recordData[domains[index]] = recordDataForDomain;
    });

    return recordData;
  }

  public async getRecordDataForDomain(domain: string): Promise<Array<RecordData>> {
    const recordData: Array<RecordData> = await this.getRecordsByDomain(domain);

    return recordData;
  }

  private async createRecord(zoneId: string, record: Record, ip?: string): Promise<RecordData> {
    const copyOfRecord: Record = {...record};
    copyOfRecord.name = record.name.toLowerCase();
    copyOfRecord.content = copyOfRecord.content ? copyOfRecord.content : ip;
    copyOfRecord.type = copyOfRecord.type ? copyOfRecord.type : 'A';

    if (!copyOfRecord.content) {
      throw Error(`Could not create Record "${copyOfRecord.name}": Content is missing!`);
    }

    if (copyOfRecord.type === 'A') {
      if (!copyOfRecord.content.match(ipv4Regex)) {
        throw Error(`Could not create Record "${copyOfRecord.name}": '${copyOfRecord.content}' is not a valid ipv4!`);
      }
    } else if (copyOfRecord.type === 'AAAA') {
      if (!copyOfRecord.content.match(ipv6Regex)) {
        throw Error(`Could not create Record "${copyOfRecord.name}": '${copyOfRecord.content}' is not a valid ipv6!`);
      }
    } else if (copyOfRecord.type === 'CNAME') {
      const parsedDomain: ParseResult = parseDomain(fromUrl(copyOfRecord.content));
      if (parsedDomain.type !== ParseResultType.Listed || !parsedDomain.domain) {
        throw Error(`Could not create Record "${copyOfRecord.name}": '${copyOfRecord.content}' is not a valid domain name!`);
      }
    }

    const response: Response & {result: RecordData} = await this.cloudflare.dnsRecords.add(zoneId, copyOfRecord);

    return response.result;
  }

  private async updateRecord(zoneId: string, recordId: string, record: Record, ip?: string): Promise<RecordData> {
    const copyOfRecord: Record = {...record};
    copyOfRecord.name = record.name.toLowerCase();
    copyOfRecord.content = copyOfRecord.content ? copyOfRecord.content : ip;
    copyOfRecord.type = copyOfRecord.type ? copyOfRecord.type : 'A';

    if (!copyOfRecord.content) {
      throw Error(`Could not update Record "${copyOfRecord.name}": Content is missing!`);
    }

    if (copyOfRecord.type === 'A') {
      if (!copyOfRecord.content.match(ipv4Regex)) {
        throw Error(`Could not update Record "${copyOfRecord.name}": '${copyOfRecord.content}' is not a valid ipv4!`);
      }
    } else if (copyOfRecord.type === 'AAAA') {
      if (!copyOfRecord.content.match(ipv6Regex)) {
        throw Error(`Could not update Record "${copyOfRecord.name}": '${copyOfRecord.content}' is not a valid ipv6!`);
      }
    } else if (copyOfRecord.type === 'CNAME') {
      const parsedDomain: ParseResult = parseDomain(fromUrl(copyOfRecord.content));
      if (parsedDomain.type !== ParseResultType.Listed || !parsedDomain.domain) {
        throw Error(`Could not update Record "${copyOfRecord.name}": '${copyOfRecord.content}' is not a valid domain name!`);
      }
    }

    const response: Response & {result: RecordData} = await this.cloudflare.dnsRecords.edit(zoneId, recordId, copyOfRecord);

    return response.result;
  }

  private async updateZoneMap(): Promise<void> {
    const response: {result: Array<ZoneData>} = await this.cloudflare.zones.browse();
    const zones: Array<ZoneData> = response.result;

    this.zoneMap = new Map();
    for (const zone of zones) {
      this.zoneMap.set(zone.name, zone.id);
    }
  }

  private async getRecordIdByNameAndType(recordName: string, recordType: string): Promise<string> {
    const record: RecordData = await this.getRecordByNameAndType(recordName, recordType);

    return record.id;
  }

  private getZoneIdByRecordName(recordName: string): Promise<string> {
    const domain: string = this.getDomainByRecordName(recordName);

    return this.getZoneIdByDomain(domain);
  }

  private async getRecordByNameAndType(recordName: string, recordType: string): Promise<RecordData> {
    const domain: string = this.getDomainByRecordName(recordName);

    const records: Array<RecordData> = await this.getRecordsByDomain(domain);

    const record: RecordData = records.find((currentRecord: RecordData): boolean => currentRecord.name.toLowerCase() === recordName.toLowerCase()
          && currentRecord.type.toLowerCase() === recordType.toLowerCase());

    const recordNotFound: boolean = record === undefined;
    if (recordNotFound) {
      throw new Error(`Record '${recordName}' not found.`);
    }

    return record;
  }

  private async getRecordIdsForRecords(records: Array<Record>): Promise<Map<string, string>> {
    const recordIdMap: Map<string, string> = new Map();

    const recordData: Array<RecordData> = await this.getRecordDataForRecords(records);

    for (const record of recordData) {
      recordIdMap.set(this.getRecordIdMapKey(record), record.id);
    }

    return recordIdMap;
  }

  private getRecordIdMapKey(record: Record): string {
    const recordName: string = record.name.toLowerCase();
    const recordType: string = record.type ? record.type.toLowerCase() : 'a';

    return `"${recordName}"_"${recordType}"`;
  }

  private async getRecordsByDomain(domain: string): Promise<Array<RecordData>> {
    const zoneId: string = await this.getZoneIdByDomain(domain);

    const records: Array<RecordData> = [];

    let pageIndex = 1;
    let allRecordsFound = false;
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
    }
    await this.updateZoneMap();

    if (!this.zoneMap.has(domain)) {
      throw new Error(`Could not find domain '${domain}'. Make sure the domain is set up for your cloudflare account.`);
    }

    const zoneId: string = this.zoneMap.get(domain.toLowerCase());

    return zoneId;
  }

  private getDomainsFromRecords(records: Array<Record>): Array<string> {
    const domains: Array<string>
      = records
        .map((record: Record): string => this.getDomainByRecordName(record.name))
        .filter((domain: string, index: number, domainList: Array<string>): boolean => domainList.indexOf(domain.toLowerCase()) === index);

    return domains;
  }

  private getDomainByRecordName(recordName: string): string {
    const parsedDomain: ParseResult = parseDomain(fromUrl(recordName));

    if (parsedDomain.type !== ParseResultType.Listed || !parsedDomain.domain) {
      throw new Error(`Could not parse domain. '${JSON.stringify(recordName)}' is not a valid record name.`);
    }

    let domain = '';
    domain += parsedDomain.domain;
    for (const tld of parsedDomain.topLevelDomains) {
      domain += `.${tld}`;
    }

    return domain.toLowerCase();
  }
}
