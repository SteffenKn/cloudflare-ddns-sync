// tslint:disable:no-unused-expression
import chai from 'chai';

import CloudflareClient from '../lib/cloudflare-client';
import IPUtils from '../lib/ip-utils';
import TestService from './test-service/test-service';

import {IRecord, Record} from '../contracts';

const expect: Chai.ExpectStatic = chai.expect;

const cloudflareClient: CloudflareClient = new CloudflareClient(TestService.getTestData().auth.email, TestService.getTestData().auth.key);

describe('Cloudflare Client', () => {
  afterEach(async() => {
    const records: Array<IRecord> = TestService.getTestData().records;
    const recordData: Array<Record> = await cloudflareClient.getRecordDataForRecords(records);

    for (const record of recordData) {
      const zoneId: string = record.zone_id;

      await cloudflareClient.removeRecord(zoneId, record.id);
    }
  });

  it('should get the zone id of a domain', async() => {
    const record: IRecord = TestService.getTestData().records[0];
    const zoneId: string = await cloudflareClient.getZoneIdByRecordName(record.name);

    expect(zoneId).to.be.string;
    expect(zoneId.length).to.be.greaterThan(0);
  });

  it('should be able to create a record', async() => {
    const record: IRecord = TestService.getTestData().records[0];
    record.content = '1.2.3.4';

    const createdRecord: Record = await cloudflareClient.syncRecord(record);

    const expectedRecordType: string = record.type ? record.type : 'A';
    expect(createdRecord.id).to.be.string;
    expect(createdRecord.id.length).to.be.greaterThan(0);
    expect(createdRecord.name).to.be.string;
    expect(createdRecord.name.length).to.be.greaterThan(0);
    expect(createdRecord.type).to.be.string;
    expect(createdRecord.type).to.equal(expectedRecordType);
  });

  it('should be able to get a record id', async() => {
    const record: IRecord = TestService.getTestData().records[0];
    record.content = '1.2.3.4';
    await cloudflareClient.syncRecord(record);

    const recordId: string = await cloudflareClient.getRecordIdByName(record.name);

    expect(recordId).to.be.string;
    expect(recordId.length).to.be.greaterThan(0);
  });

  it('should be able to remove a record', async() => {
    const record: IRecord = TestService.getTestData().records[0];
    record.content = '1.2.3.4';
    await cloudflareClient.syncRecord(record);
    const zoneId: string = await cloudflareClient.getZoneIdByRecordName(record.name);
    const recordId: string = await cloudflareClient.getRecordIdByName(record.name);

    await cloudflareClient.removeRecord(zoneId, recordId);
  });

  it('should get record data for records', async() => {
    const records: Array<IRecord> = TestService.getTestData().records;
    for (const record of records) {
      await cloudflareClient.syncRecord(record, '1.2.3.4');
    }

    const recordData: Array<Record> = await cloudflareClient.getRecordDataForRecords(records);

    const recordDataNames: Array<string> = recordData.map((recordDataEntry: Record) => {
      return recordDataEntry.name;
    });

    expect(recordData.length).to.equal(records.length);
    expect(recordDataNames).to.contain(records[0].name);
  });

  it('should sync existing record', async() => {
    const record: IRecord = TestService.getTestData().records[0];
    await cloudflareClient.syncRecord(record);

    const recordData: Record = await cloudflareClient.syncRecord(record);

    expect(recordData.name).to.equal(record.name);
  });

  it('should sync with ip via parameter', async() => {
    const record: IRecord = TestService.getTestData().records[0];
    const randomIp: string = getRandomIp();

    const recordData: Record = await cloudflareClient.syncRecord(record, randomIp);

    expect(recordData.name).to.equal(record.name);
    expect(recordData.content).to.equal(randomIp);
  });

  it('should sync with ip via record.content', async() => {
    const record: IRecord = TestService.getTestData().records[0];
    const randomIp: string = getRandomIp();
    record.content = randomIp;

    const recordData: Record = await cloudflareClient.syncRecord(record);

    expect(recordData.name).to.equal(record.name);
    expect(recordData.content).to.equal(randomIp);
  });

  it('should sync with external ip', async() => {
    const record: IRecord = TestService.getTestData().records[0];
    record.content = undefined;
    const currentIp: string = await IPUtils.getIp();

    const recordData: Record = await cloudflareClient.syncRecord(record);

    expect(recordData.name).to.equal(record.name);
    expect(recordData.content).to.equal(currentIp);
  });
});

function getRandomIp(): string {
  return `${getRandomNumber()}.${getRandomNumber()}.${getRandomNumber()}.${getRandomNumber()}`;
}

function getRandomNumber(): number {
  return Math.floor(Math.random() * 9) + 1;
}
