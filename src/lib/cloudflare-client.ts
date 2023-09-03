import {ParseResultType, fromUrl, parseDomain} from 'parse-domain';
import Cloudflare from 'cloudflare';

import {Auth, DomainRecordList, Record, RecordData, ZoneData, ZoneMap} from '../contracts/index.js';
import IPUtils from './ip-utils.js';

const ipv4Regex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/u;
const ipv6Regex =
  /^(?:(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){6})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:::(?:(?:(?:[0-9a-fA-F]{1,4})):){5})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){4})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,1}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){3})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,2}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){2})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,3}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:[0-9a-fA-F]{1,4})):)(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,4}(?:(?:[0-9a-fA-F]{1,4})))?::)(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,5}(?:(?:[0-9a-fA-F]{1,4})))?::)(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,6}(?:(?:[0-9a-fA-F]{1,4})))?::))))$/u;

export default class CloudflareClient {
  private cloudflare: Cloudflare;

  private zoneMap: ZoneMap = new Map();

  constructor(auth: Auth) {
    this.cloudflare = new Cloudflare(auth);

    this.updateZoneMap();
  }

  public async syncRecord(record: Record, ip?: string): Promise<RecordData> {
    const recordIds: Map<string, string> = await this.getRecordIdsForRecords([record]);
    const ipToUse = ip ? ip : await IPUtils.getIpv4();

    const zoneId = await this.getZoneIdByRecordName(record.name);
    const recordId = recordIds.get(this.getRecordIdMapKey(record));

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
    const ipToUse = ip ? ip : await IPUtils.getIpv4();

    const resultPromises: Array<Promise<RecordData>> = records.map(async (record: Record): Promise<RecordData> => {
      const zoneId = await this.getZoneIdByRecordName(record.name);
      const recordId = recordIds.get(this.getRecordIdMapKey(record));

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
    const recordTypeToUse = recordType ? recordType : 'A';

    const zoneId = await this.getZoneIdByRecordName(recordName);
    const recordId = await this.getRecordIdByNameAndType(recordName, recordTypeToUse);

    await this.cloudflare.dnsRecords.del(zoneId, recordId);
  }

  public async getRecordDataForRecord(record: Record): Promise<RecordData> {
    const domain = this.getDomainByRecordName(record.name);

    const recordDataForDomain: Array<RecordData> = await this.getRecordsByDomain(domain);

    const recordData: RecordData = recordDataForDomain.find((singleRecordData: RecordData): boolean => record.name.toLowerCase() === singleRecordData.name.toLowerCase());

    return recordData;
  }

  public async getRecordDataForRecords(records: Array<Record>): Promise<Array<RecordData>> {
    const domains: Array<string> = this.getDomainsFromRecords(records);

    const recordDataPromises = domains.map(async (domain): Promise<Array<RecordData>> => {
      const recordDataForDomain = await this.getRecordsByDomain(domain);

      const recordDataForDomainFilteredByRecords = recordDataForDomain.filter((singleRecordData: RecordData): boolean =>
        records.some((record: Record): boolean => record.name.toLowerCase() === singleRecordData.name.toLowerCase()),
      );

      return recordDataForDomainFilteredByRecords;
    });

    const recordDataForDomains: Array<Array<RecordData>> = await Promise.all(recordDataPromises);
    const recordData = [].concat(...recordDataForDomains);

    return recordData;
  }

  public async getRecordDataForDomains(domains: Array<string>): Promise<DomainRecordList> {
    const recordDataPromises = domains.map((domain: string) => this.getRecordDataForDomain(domain));

    const recordDataForDomains = await Promise.all(recordDataPromises);

    const recordData: DomainRecordList = {};
    recordDataForDomains.forEach((recordDataForDomain, index): void => {
      recordData[domains[index]] = recordDataForDomain;
    });

    return recordData;
  }

  public async getRecordDataForDomain(domain: string): Promise<Array<RecordData>> {
    const recordData: Array<RecordData> = await this.getRecordsByDomain(domain);

    return recordData;
  }

  private async createRecord(zoneId: string, record: Record, ip?: string): Promise<RecordData> {
    const dnsRecord: Cloudflare.DnsRecord = {
      ...record,
      name: record.name.toLowerCase(),
      content: record.content ? record.content : ip,
      type: record.type ? record.type : 'A',
      ttl: record.ttl ? record.ttl : 1,
    };

    if (!dnsRecord.content) {
      throw Error(`Could not create Record "${dnsRecord.name}": Content is missing!`);
    }

    if (dnsRecord.type === 'A') {
      if (!dnsRecord.content.match(ipv4Regex)) {
        throw Error(`Could not create Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid ipv4!`);
      }
    } else if (dnsRecord.type === 'AAAA') {
      if (!dnsRecord.content.match(ipv6Regex)) {
        throw Error(`Could not create Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid ipv6!`);
      }
    } else if (dnsRecord.type === 'CNAME') {
      const parsedDomain = parseDomain(fromUrl(dnsRecord.content));
      if (parsedDomain.type !== ParseResultType.Listed || !parsedDomain.domain) {
        throw Error(`Could not create Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid domain name!`);
      }
    }

    const response = (await this.cloudflare.dnsRecords.add(zoneId, dnsRecord as Cloudflare.DnsRecord)) as {result: RecordData};

    return response.result;
  }

  private async updateRecord(zoneId: string, recordId: string, record: Record, ip?: string): Promise<RecordData> {
    const dnsRecord: Cloudflare.DnsRecord = {
      ...record,
      name: record.name.toLowerCase(),
      content: record.content ? record.content : ip,
      type: record.type ? record.type : 'A',
      ttl: record.ttl ? record.ttl : 1,
    };

    if (!dnsRecord.content) {
      throw Error(`Could not update Record "${dnsRecord.name}": Content is missing!`);
    }

    if (dnsRecord.type === 'A') {
      if (!dnsRecord.content.match(ipv4Regex)) {
        throw Error(`Could not update Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid ipv4!`);
      }
    } else if (dnsRecord.type === 'AAAA') {
      if (!dnsRecord.content.match(ipv6Regex)) {
        throw Error(`Could not update Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid ipv6!`);
      }
    } else if (dnsRecord.type === 'CNAME') {
      const parsedDomain = parseDomain(fromUrl(dnsRecord.content));
      if (parsedDomain.type !== ParseResultType.Listed || !parsedDomain.domain) {
        throw Error(`Could not update Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid domain name!`);
      }
    }

    const response = (await this.cloudflare.dnsRecords.edit(zoneId, recordId, dnsRecord)) as {result: RecordData};

    return response.result;
  }

  private async updateZoneMap(): Promise<void> {
    const response = (await this.cloudflare.zones.browse()) as {result: Array<ZoneData>};
    const zones = response.result;

    this.zoneMap = new Map();
    for (const zone of zones) {
      this.zoneMap.set(zone.name, zone.id);
    }
  }

  private async getRecordIdByNameAndType(recordName: string, recordType: string): Promise<string> {
    const record = await this.getRecordByNameAndType(recordName, recordType);

    return record.id;
  }

  private getZoneIdByRecordName(recordName: string): Promise<string> {
    const domain = this.getDomainByRecordName(recordName);

    return this.getZoneIdByDomain(domain);
  }

  private async getRecordByNameAndType(recordName: string, recordType: string): Promise<RecordData> {
    const domain = this.getDomainByRecordName(recordName);

    const records = await this.getRecordsByDomain(domain);

    const record = records.find(
      (currentRecord: RecordData): boolean => currentRecord.name.toLowerCase() === recordName.toLowerCase() && currentRecord.type.toLowerCase() === recordType.toLowerCase(),
    );

    const recordNotFound = record === undefined;
    if (recordNotFound) {
      throw new Error(`Record '${recordName}' not found.`);
    }

    return record;
  }

  private async getRecordIdsForRecords(records: Array<Record>): Promise<Map<string, string>> {
    const recordIdMap: Map<string, string> = new Map();

    const recordData = await this.getRecordDataForRecords(records);

    for (const record of recordData) {
      recordIdMap.set(this.getRecordIdMapKey(record), record.id);
    }

    return recordIdMap;
  }

  private getRecordIdMapKey(record: Record): string {
    const recordName = record.name.toLowerCase();
    const recordType = record.type ? record.type.toLowerCase() : 'a';

    return `"${recordName}"_"${recordType}"`;
  }

  private async getRecordsByDomain(domain: string): Promise<Array<RecordData>> {
    const zoneId = await this.getZoneIdByDomain(domain);

    const records: Array<RecordData> = [];

    let pageIndex = 1;
    let allRecordsFound = false;
    const recordsPerPage = 5000;

    while (!allRecordsFound) {
      const response = (await (this.cloudflare as any).dnsRecords.browse(zoneId, {
        page: pageIndex,
        per_page: recordsPerPage,
      })) as {result: Array<RecordData>};

      records.push(...response.result);

      allRecordsFound = response.result.length < recordsPerPage;

      pageIndex++;
    }

    return records;
  }

  private async getZoneIdByDomain(domain: string): Promise<string> {
    if (this.zoneMap.has(domain)) {
      const zoneId = this.zoneMap.get(domain.toLowerCase());

      return zoneId;
    }
    await this.updateZoneMap();

    if (!this.zoneMap.has(domain)) {
      throw new Error(`Could not find domain '${domain}'. Make sure the domain is set up for your cloudflare account.`);
    }

    const zoneId = this.zoneMap.get(domain.toLowerCase());

    return zoneId;
  }

  private getDomainsFromRecords(records: Array<Record>): Array<string> {
    const domains = records.map((record) => this.getDomainByRecordName(record.name)).filter((domain, index, domainList) => domainList.indexOf(domain.toLowerCase()) === index);

    return domains;
  }

  private getDomainByRecordName(recordName: string): string {
    const parsedDomain = parseDomain(fromUrl(recordName));

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
