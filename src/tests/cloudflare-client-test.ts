// tslint:disable:no-unused-expression
import chai from 'chai';

import CloudflareClient from '../lib/cloudflare-client';
import IPUtils from '../lib/ip-utils';
import TestService, { TestData } from './test-service/test-service';

import {Record, RecordData} from '../contracts';

const expect: Chai.ExpectStatic = chai.expect;

const cloudflareClient: CloudflareClient = new CloudflareClient(TestService.getTestData().auth.email, TestService.getTestData().auth.key);

const recordsToCleanUp: Array<Record> = [];

describe('Cloudflare Client', () => {
  afterEach(async() => {
    const recordData: Array<RecordData> = await cloudflareClient.getRecordDataForRecords(recordsToCleanUp);

    for (const record of recordData) {
      const zoneId: string = record.zone_id;

      await cloudflareClient.removeRecord(zoneId, record.id);

      const indexOfRecord: number = recordsToCleanUp.findIndex((recordToCleanup: Record) => {
        return record.name = recordToCleanup.name;
      });

      recordsToCleanUp.splice(indexOfRecord, 1);
    }
  });

  it('should get the zone id of a domain', async() => {
    const record: Record = TestService.getTestData().records[0];
    const zoneId: string = await cloudflareClient.getZoneIdByRecordName(record.name);

    expect(zoneId).to.be.string;
    expect(zoneId.length).to.be.greaterThan(0);
  });

  it('should be able to create a record', async() => {
    // Prepare
    const record: Record = TestService.getTestData().records[0];
    record.content = '1.2.3.4';
    // Prepare END

    const createdRecord: RecordData = await cloudflareClient.syncRecord(record);

    const expectedRecordType: string = record.type ? record.type : 'A';
    expect(createdRecord.id).to.be.string;
    expect(createdRecord.id.length).to.be.greaterThan(0);
    expect(createdRecord.name).to.be.string;
    expect(createdRecord.name.length).to.be.greaterThan(0);
    expect(createdRecord.type).to.be.string;
    expect(createdRecord.type).to.equal(expectedRecordType);

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should be able to get a record id', async() => {
    // Prepare
    const record: Record = TestService.getTestData().records[0];
    record.content = '1.2.3.4';
    await cloudflareClient.syncRecord(record);
    // Pepare END

    const recordId: string = await cloudflareClient.getRecordIdByName(record.name);

    expect(recordId).to.be.string;
    expect(recordId.length).to.be.greaterThan(0);

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should be able to remove a record', async() => {
    // Prepare
    const record: Record = TestService.getTestData().records[0];
    record.content = '1.2.3.4';
    await cloudflareClient.syncRecord(record);
    const zoneId: string = await cloudflareClient.getZoneIdByRecordName(record.name);
    const recordId: string = await cloudflareClient.getRecordIdByName(record.name);
    // Prepare END

    await cloudflareClient.removeRecord(zoneId, recordId);
  });

  it('should get record data for records', async() => {
    // Prepare
    const records: Array<Record> = TestService.getTestData().records;
    for (const record of records) {
      await cloudflareClient.syncRecord(record, '1.2.3.4');
    }
    // Prepare END

    const recordData: Array<RecordData> = await cloudflareClient.getRecordDataForRecords(records);

    const recordDataNames: Array<string> = recordData.map((recordDataEntry: RecordData) => {
      return recordDataEntry.name;
    });

    expect(recordData.length).to.equal(records.length);

    for (const record of records) {
     expect(recordDataNames).to.contain(record.name);
    }

    // Cleanup
    recordsToCleanUp.push(...records);
    // Cleanup END
  });

  it('should sync existing record', async() => {
    // Prepare
    const record: Record = TestService.getTestData().records[0];
    await cloudflareClient.syncRecord(record);
    // Prepare END

    const recordData: RecordData = await cloudflareClient.syncRecord(record);

    expect(recordData.name.toLowerCase()).to.equal(record.name.toLowerCase());

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should sync with ip via parameter', async() => {
    // Prepare
    const record: Record = TestService.getTestData().records[0];
    const randomIp: string = getRandomIp();
    // Prepare END

    const recordData: RecordData = await cloudflareClient.syncRecord(record, randomIp);

    expect(recordData.name.toLowerCase()).to.equal(record.name.toLowerCase());
    expect(recordData.content).to.equal(randomIp);

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should sync with ip via record.content', async() => {
    // Prepare
    const record: Record = TestService.getTestData().records[0];
    const randomIp: string = getRandomIp();
    record.content = randomIp;
    // Prepare END

    const recordData: RecordData = await cloudflareClient.syncRecord(record);

    expect(recordData.name.toLowerCase()).to.equal(record.name.toLowerCase());
    expect(recordData.content).to.equal(randomIp);

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should sync with external ip', async() => {
    // Prepare
    const record: Record = TestService.getTestData().records[0];
    record.content = undefined;
    const currentIp: string = await IPUtils.getIp();
    // Prepare END

    const recordData: RecordData = await cloudflareClient.syncRecord(record);

    expect(recordData.name.toLowerCase()).to.equal(record.name.toLowerCase());
    expect(recordData.content).to.equal(currentIp);

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });
});

function getRandomIp(): string {
  return `${getRandomNumber()}.${getRandomNumber()}.${getRandomNumber()}.${getRandomNumber()}`;
}

function getRandomNumber(): number {
  return Math.floor(Math.random() * 9) + 1;
}
