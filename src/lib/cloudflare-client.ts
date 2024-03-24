import {ParseResultType, fromUrl, parseDomain} from 'parse-domain';
import Cloudflare, {ClientOptions as CloudflareOptions} from 'cloudflare';

import {DomainRecordList, Record, RecordData, ZoneMap} from '../types/index.js';
import IPUtils from './ip-utils.js';

const ipv4Regex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/u;
const ipv6Regex =
  /^(?:(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){6})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:::(?:(?:(?:[0-9a-fA-F]{1,4})):){5})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){4})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,1}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){3})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,2}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){2})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,3}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:[0-9a-fA-F]{1,4})):)(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,4}(?:(?:[0-9a-fA-F]{1,4})))?::)(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,5}(?:(?:[0-9a-fA-F]{1,4})))?::)(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,6}(?:(?:[0-9a-fA-F]{1,4})))?::))))$/u;

export default class CloudflareClient {
  private cloudflare: Cloudflare;

  private zoneMap: ZoneMap = new Map();

  constructor(cloudflareOptions: CloudflareOptions) {
    this.cloudflare = new Cloudflare(cloudflareOptions);

    this.updateZoneMap();
  }

  public async syncRecord(record: Record, ip?: string) {
    const recordIds = await this.getRecordIdsForRecords([record]);
    const ipToUse = ip ? ip : await IPUtils.getIpv4();

    const zoneId = await this.getZoneIdByRecordName(record.name);
    const recordId = recordIds.get(this.getRecordIdMapKey(record));

    const recordExists = recordId !== undefined;
    if (recordExists) {
      const result = await this.updateRecord(zoneId, recordId, record, ipToUse);

      return result;
    }
    const result = await this.createRecord(zoneId, record, ipToUse);

    return result;
  }

  public async syncRecords(records: Array<Record>, ip?: string) {
    const recordIds = await this.getRecordIdsForRecords(records);
    const ipToUse = ip ? ip : await IPUtils.getIpv4();

    const resultPromises = records.map(async (record: Record) => {
      const zoneId = await this.getZoneIdByRecordName(record.name);
      const recordId = recordIds.get(this.getRecordIdMapKey(record));

      const recordExists = recordId !== undefined;
      if (recordExists) {
        const currentResult = await this.updateRecord(zoneId, recordId, record, ipToUse);

        return currentResult;
      }
      const currentResult = await this.createRecord(zoneId, record, ipToUse);

      return currentResult;
    });

    const results = await Promise.all(resultPromises);

    return results;
  }

  public async removeRecordByNameAndType(recordName: string, recordType?: string) {
    const recordTypeToUse = recordType ? recordType : 'A';

    const zoneId = await this.getZoneIdByRecordName(recordName);
    const recordId = await this.getRecordIdByNameAndType(recordName, recordTypeToUse);

    await this.cloudflare.dns.records.delete(recordId, {zone_id: zoneId});
  }

  public async getRecordDataForRecord(record: Record) {
    const domain = this.getDomainByRecordName(record.name);

    const recordDataForDomain = await this.getRecordsByDomain(domain);

    const recordData = recordDataForDomain.find((singleRecordData) => record.name.toLowerCase() === singleRecordData.name.toLowerCase());

    return recordData;
  }

  public async getRecordDataForRecords(records: Array<Record>) {
    const domains = this.getDomainsFromRecords(records);

    const recordDataPromises = domains.map(async (domain) => {
      const recordDataForDomain = await this.getRecordsByDomain(domain);

      const recordDataForDomainFilteredByRecords = recordDataForDomain.filter((singleRecordData) =>
        records.some((record) => record.name.toLowerCase() === singleRecordData.name.toLowerCase()),
      );

      return recordDataForDomainFilteredByRecords;
    });

    const recordDataForDomains = await Promise.all(recordDataPromises);
    const recordData = [].concat(...recordDataForDomains);

    return recordData;
  }

  public async getRecordsByDomains(domains: Array<string>) {
    const recordDataPromises = domains.map((domain) => this.getRecordsByDomain(domain));

    const recordDataForDomains = await Promise.all(recordDataPromises);

    const recordData: DomainRecordList = {};
    recordDataForDomains.forEach((recordDataForDomain, index) => {
      recordData[domains[index]] = recordDataForDomain;
    });

    return recordData;
  }

  public async getRecordsByDomain(domain: string) {
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

  private async createRecord(zoneId: string, recordData: Record, ip?: string) {
    const dnsRecordToCreate = {
      ...recordData,
      name: recordData.name.toLowerCase(),
      content: recordData.content ? recordData.content : ip,
      type: recordData.type ? recordData.type : 'A',
      ttl: recordData.ttl ? recordData.ttl : 1,
      zone_id: zoneId,
    };

    if (!dnsRecordToCreate.content) {
      throw Error(`Could not create Record "${dnsRecordToCreate.name}": Content is missing!`);
    }

    if (dnsRecordToCreate.type === 'A') {
      if (!dnsRecordToCreate.content.match(ipv4Regex)) {
        throw Error(`Could not create Record "${dnsRecordToCreate.name}": '${dnsRecordToCreate.content}' is not a valid ipv4!`);
      }
    } else if (dnsRecordToCreate.type === 'AAAA') {
      if (!dnsRecordToCreate.content.match(ipv6Regex)) {
        throw Error(`Could not create Record "${dnsRecordToCreate.name}": '${dnsRecordToCreate.content}' is not a valid ipv6!`);
      }
    } else if (dnsRecordToCreate.type === 'CNAME') {
      const parsedDomain = parseDomain(fromUrl(dnsRecordToCreate.content));
      if (parsedDomain.type !== ParseResultType.Listed || !parsedDomain.domain) {
        throw Error(`Could not create Record "${dnsRecordToCreate.name}": '${dnsRecordToCreate.content}' is not a valid domain name!`);
      }
    }

    return this.cloudflare.dns.records.create(dnsRecordToCreate);
  }

  private async updateRecord(zoneId: string, recordId: string, recordData: Record, ip?: string) {
    const updatedDnsRecord = {
      ...recordData,
      name: recordData.name.toLowerCase(),
      content: recordData.content ? recordData.content : ip,
      type: recordData.type ? recordData.type : 'A',
      ttl: recordData.ttl ? recordData.ttl : 1,
      zone_id: zoneId,
    };

    if (!updatedDnsRecord.content) {
      throw Error(`Could not update Record "${updatedDnsRecord.name}": Content is missing!`);
    }

    if (updatedDnsRecord.type === 'A') {
      if (!updatedDnsRecord.content.match(ipv4Regex)) {
        throw Error(`Could not update Record "${updatedDnsRecord.name}": '${updatedDnsRecord.content}' is not a valid ipv4!`);
      }
    } else if (updatedDnsRecord.type === 'AAAA') {
      if (!updatedDnsRecord.content.match(ipv6Regex)) {
        throw Error(`Could not update Record "${updatedDnsRecord.name}": '${updatedDnsRecord.content}' is not a valid ipv6!`);
      }
    } else if (updatedDnsRecord.type === 'CNAME') {
      const parsedDomain = parseDomain(fromUrl(updatedDnsRecord.content));
      if (parsedDomain.type !== ParseResultType.Listed || !parsedDomain.domain) {
        throw Error(`Could not update Record "${updatedDnsRecord.name}": '${updatedDnsRecord.content}' is not a valid domain name!`);
      }
    }

    return await this.cloudflare.dns.records.edit(recordId, updatedDnsRecord);
  }

  private async updateZoneMap() {
    const response = await this.cloudflare.zones.list();
    let zones = response.result;

    let nextPageExists = response.hasNextPage();
    while (nextPageExists) {
      const nextPageResponse = await response.getNextPage();
      zones = zones.concat(nextPageResponse.result);

      nextPageExists = nextPageResponse.hasNextPage();
    }

    this.zoneMap = new Map();
    for (const zone of zones) {
      this.zoneMap.set(zone.name, zone.id);
    }
  }

  private async getRecordIdByNameAndType(recordName: string, recordType: string) {
    const record = await this.getRecordByNameAndType(recordName, recordType);

    return record.id;
  }

  private getZoneIdByRecordName(recordName: string) {
    const domain = this.getDomainByRecordName(recordName);

    return this.getZoneIdByDomain(domain);
  }

  private async getRecordByNameAndType(recordName: string, recordType: string) {
    const domain = this.getDomainByRecordName(recordName);

    const records = await this.getRecordsByDomain(domain);

    const record = records.find((currentRecord) => currentRecord.name.toLowerCase() === recordName.toLowerCase() && currentRecord.type.toLowerCase() === recordType.toLowerCase());

    const recordNotFound = record === undefined;
    if (recordNotFound) {
      throw new Error(`Record '${recordName}' not found.`);
    }

    return record;
  }

  private async getRecordIdsForRecords(records: Array<Record>) {
    const recordIdMap = new Map();

    const recordData = await this.getRecordDataForRecords(records);

    for (const record of recordData) {
      recordIdMap.set(this.getRecordIdMapKey(record), record.id);
    }

    return recordIdMap;
  }

  private getRecordIdMapKey(record: Record) {
    const recordName = record.name.toLowerCase();
    const recordType = record.type ? record.type.toLowerCase() : 'a';

    return `"${recordName}"_"${recordType}"`;
  }

  private async getZoneIdByDomain(domain: string) {
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

  private getDomainsFromRecords(records: Array<Record>) {
    const domains = records.map((record) => this.getDomainByRecordName(record.name)).filter((domain, index, domainList) => domainList.indexOf(domain.toLowerCase()) === index);

    return domains;
  }

  private getDomainByRecordName(recordName: string) {
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
