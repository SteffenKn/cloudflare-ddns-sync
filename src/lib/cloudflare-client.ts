import {ParseResultType, fromUrl, parseDomain} from 'parse-domain';
import Cloudflare from 'cloudflare';
import type {RecordCreateParams, RecordUpdateParams} from 'cloudflare/resources/dns/records';
import {isIP} from 'node:net';

import {Auth, DomainRecordList, Record, RecordData, ZoneMap} from '../types/index.js';

type DnsRecord = Record & {
  name: string;
  content: string;
  type: NonNullable<Record['type']>;
  ttl: number;
};

type RecordOperation = 'create' | 'update';

export default class CloudflareClient {
  private cloudflare: Cloudflare;

  private zoneMap: ZoneMap = new Map();

  constructor(auth: Auth) {
    const isUserServiceKey = auth.key?.startsWith('v1.0-');
    this.cloudflare = new Cloudflare({
      apiEmail: auth.key && !isUserServiceKey ? (auth.email ?? null) : null,
      apiKey: !isUserServiceKey ? auth.key || null : null,
      apiToken: auth.key ? null : auth.token || null,
      userServiceKey: isUserServiceKey ? auth.key : null,
      timeout: 10_000,
    });
  }

  public async syncRecord(record: Record, ip?: string): Promise<RecordData> {
    const [result] = await this.syncRecords([record], ip);

    return result;
  }

  public async syncRecords(records: Array<Record>, ip?: string): Promise<Array<RecordData>> {
    const recordIds = await this.getRecordIdsForRecords(records);

    return Promise.all(
      records.map(async (record): Promise<RecordData> => {
        const zoneId = await this.getZoneIdByRecordName(record.name);
        const recordId = recordIds.get(this.getRecordIdMapKey(record));

        return recordId ? this.updateRecord(zoneId, recordId, record, ip) : this.createRecord(zoneId, record, ip);
      }),
    );
  }

  public async removeRecordByNameAndType(recordName: string, recordType = 'A'): Promise<void> {
    const zoneId = await this.getZoneIdByRecordName(recordName);
    const recordId = await this.getRecordIdByNameAndType(recordName, recordType);

    await this.cloudflare.dns.records.delete(recordId, {zone_id: zoneId});
  }

  public async getRecordDataForRecord(record: Record): Promise<RecordData> {
    const records = await this.getRecordsByDomain(this.getDomainByRecordName(record.name));

    return records.find((entry): boolean => entry.name.toLowerCase() === record.name.toLowerCase());
  }

  public async getRecordDataForRecords(records: Array<Record>): Promise<Array<RecordData>> {
    const recordNames = new Set(records.map((record) => record.name.toLowerCase()));
    const recordsByDomain = await Promise.all(this.getDomainsFromRecords(records).map((domain) => this.getRecordsByDomain(domain)));

    return recordsByDomain.flat().filter((record): boolean => recordNames.has(record.name.toLowerCase()));
  }

  public async getRecordDataForDomains(domains: Array<string>): Promise<DomainRecordList> {
    const recordsByDomain = await Promise.all(domains.map(async (domain) => [domain, await this.getRecordDataForDomain(domain)] as const));

    return Object.fromEntries(recordsByDomain);
  }

  public getRecordDataForDomain(domain: string): Promise<Array<RecordData>> {
    return this.getRecordsByDomain(domain);
  }

  private async createRecord(zoneId: string, record: Record, ip?: string): Promise<RecordData> {
    const dnsRecord = this.prepareRecord(record, 'create', ip);
    const response = await this.cloudflare.dns.records.create({zone_id: zoneId, ...dnsRecord} as RecordCreateParams);

    return response as RecordData;
  }

  private async updateRecord(zoneId: string, recordId: string, record: Record, ip?: string): Promise<RecordData> {
    const dnsRecord = this.prepareRecord(record, 'update', ip);
    const response = await this.cloudflare.dns.records.update(recordId, {zone_id: zoneId, ...dnsRecord} as RecordUpdateParams);

    return response as RecordData;
  }

  private prepareRecord(record: Record, operation: RecordOperation, ip?: string): DnsRecord {
    const dnsRecord: DnsRecord = {
      ...record,
      name: record.name.toLowerCase(),
      content: record.content || ip || '',
      type: record.type || 'A',
      ttl: record.ttl || 1,
    };

    if (!dnsRecord.content) {
      throw Error(`Could not ${operation} Record "${dnsRecord.name}": Content is missing!`);
    }

    if (dnsRecord.type === 'A' && isIP(dnsRecord.content) !== 4) {
      throw Error(`Could not ${operation} Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid ipv4!`);
    }
    if (dnsRecord.type === 'AAAA' && isIP(dnsRecord.content) !== 6) {
      throw Error(`Could not ${operation} Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid ipv6!`);
    }
    if (dnsRecord.type === 'CNAME' && !this.isValidDomain(dnsRecord.content)) {
      throw Error(`Could not ${operation} Record "${dnsRecord.name}": '${dnsRecord.content}' is not a valid domain name!`);
    }

    return dnsRecord;
  }

  private async updateZoneMap(): Promise<void> {
    const zones: ZoneMap = new Map();
    for await (const zone of this.cloudflare.zones.list()) {
      zones.set(zone.name.toLowerCase(), zone.id);
    }
    this.zoneMap = zones;
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
    const records = await this.getRecordsByDomain(this.getDomainByRecordName(recordName));
    const record = records.find((entry): boolean => entry.name.toLowerCase() === recordName.toLowerCase() && entry.type.toLowerCase() === recordType.toLowerCase());

    if (!record) {
      throw new Error(`Record '${recordName}' not found.`);
    }

    return record;
  }

  private async getRecordIdsForRecords(records: Array<Record>): Promise<Map<string, string>> {
    const recordData = await this.getRecordDataForRecords(records);
    const recordIds = new Map<string, string>();
    for (const record of recordData) {
      recordIds.set(this.getRecordIdMapKey(record), record.id);
    }

    return recordIds;
  }

  private getRecordIdMapKey(record: Record): string {
    return `${record.name.toLowerCase()}\u0000${(record.type || 'A').toLowerCase()}`;
  }

  private async getRecordsByDomain(domain: string): Promise<Array<RecordData>> {
    const zoneId = await this.getZoneIdByDomain(domain);
    const records: Array<RecordData> = [];

    for await (const record of this.cloudflare.dns.records.list({zone_id: zoneId, per_page: 5000})) {
      records.push(record as RecordData);
    }

    return records;
  }

  private async getZoneIdByDomain(domain: string): Promise<string> {
    const normalizedDomain = domain.toLowerCase();
    let zoneId = this.zoneMap.get(normalizedDomain);
    if (zoneId) {
      return zoneId;
    }

    await this.updateZoneMap();
    zoneId = this.zoneMap.get(normalizedDomain);
    if (!zoneId) {
      throw new Error(`Could not find domain '${normalizedDomain}'. Make sure the domain is set up for your cloudflare account.`);
    }

    return zoneId;
  }

  private getDomainsFromRecords(records: Array<Record>): Array<string> {
    return [...new Set(records.map((record) => this.getDomainByRecordName(record.name)))];
  }

  private getDomainByRecordName(recordName: string): string {
    const parsedDomain = parseDomain(fromUrl(recordName));

    if (parsedDomain.type !== ParseResultType.Listed || !parsedDomain.domain) {
      throw new Error(`Could not parse domain. '${JSON.stringify(recordName)}' is not a valid record name.`);
    }

    return [parsedDomain.domain, ...parsedDomain.topLevelDomains].join('.').toLowerCase();
  }

  private isValidDomain(value: string): boolean {
    const parsedDomain = parseDomain(fromUrl(value));

    return parsedDomain.type === ParseResultType.Listed && Boolean(parsedDomain.domain);
  }
}
