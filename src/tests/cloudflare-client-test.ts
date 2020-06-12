// tslint:disable:no-unused-expression
import chai from 'chai';

import CloudflareClient from '../lib/cloudflare-client';
import IPUtils from '../lib/ip-utils';
import TestService, { TestData } from './test-service/test-service';

import {DomainRecordList, Record, RecordData} from '../contracts';

const expect: Chai.ExpectStatic = chai.expect;

const cloudflareClient: CloudflareClient = new CloudflareClient(TestService.getTestData().auth.email, TestService.getTestData().auth.key);

const recordsToCleanUp: Array<Record> = [];

describe('Cloudflare Client', (): void => {
  afterEach(async(): Promise<void> => {
    const recordData: Array<RecordData> = await cloudflareClient.getRecordDataForRecords(recordsToCleanUp);

    for (const record of recordData) {
      await cloudflareClient.removeRecordByName(record.name);

      const indexOfRecord: number = recordsToCleanUp.findIndex((recordToCleanup: Record): boolean => {
        return record.name.toLowerCase() === recordToCleanup.name.toLowerCase();
      });

      recordsToCleanUp.splice(indexOfRecord, 1);
    }
  });

  it('should be able to create a record', async(): Promise<void> => {
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

  it('should be able to remove a record', async(): Promise<void> => {
    // Prepare
    const record: Record = TestService.getTestData().records[0];
    record.content = '1.2.3.4';
    await cloudflareClient.syncRecord(record);
    // Prepare END

    await cloudflareClient.removeRecordByName(record.name);
  });

  it('should get record data for records', async(): Promise<void> => {
    // Prepare
    const records: Array<Record> = TestService.getTestData().records;
    await cloudflareClient.syncRecords(records, '1.2.3.4');
    // Prepare END

    const recordData: Array<RecordData> = await cloudflareClient.getRecordDataForRecords(records);

    const recordDataNames: Array<string> = recordData.map((recordDataEntry: RecordData): string => {
      return recordDataEntry.name.toLowerCase();
    });

    expect(recordData.length).to.equal(records.length);

    for (const record of records) {
     expect(recordDataNames).to.contain(record.name.toLowerCase());
    }

    // Cleanup
    recordsToCleanUp.push(...records);
    // Cleanup END
  });

  it('should sync existing record', async(): Promise<void> => {
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

  it('should sync multiple records', async(): Promise<void> => {
    // Prepare
    const records: Array<Record> = TestService.getTestData().records;
    // Prepare END

    const recordData: Array<RecordData> = await cloudflareClient.syncRecords(records);

    const recordDataNames: Array<string> = recordData.map((singleRecordData: RecordData): string => {
      return singleRecordData.name.toLowerCase();
    });

    for (const record of records) {
      expect(recordDataNames).to.contain(record.name.toLowerCase());
    }

    // Cleanup
    recordsToCleanUp.push(...records);
    // Cleanup END
  });

  it('should sync with ip via parameter', async(): Promise<void> => {
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

  it('should sync with ip via record.content', async(): Promise<void> => {
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

  it('should sync with external ip', async(): Promise<void> => {
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

  it ('should get record data for domain', async(): Promise<void> => {
    // Prepare
    const testData: TestData = TestService.getTestData();
    const domain: string = testData.domain;
    const records: Array<Record> = testData.records;
    await cloudflareClient.syncRecords(records, '1.2.3.4');
    // Prepare END

    const recordData: Array<RecordData> = await cloudflareClient.getRecordDataForDomain(domain);

    const recordDataNames: Array<string> = recordData.map((recordDataEntry: RecordData): string => {
      return recordDataEntry.name.toLowerCase();
    });

    // At least the data of the synced records should be existing
    expect(recordData.length).to.be.greaterThan(records.length - 1);
    for (const record of records) {
      expect(recordDataNames).to.contain(record.name.toLowerCase());
    }

    // Cleanup
    recordsToCleanUp.push(...records);
    // Cleanup END
  });

  it ('should get record data for multiple domains', async(): Promise<void> => {
    // Prepare
    const testData: TestData = TestService.getTestData();
    const domain: string = testData.domain;
    const records: Array<Record> = testData.records;
    await cloudflareClient.syncRecords(records, '1.2.3.4');
    // Prepare END

    const domainRecordList: DomainRecordList = await cloudflareClient.getRecordDataForDomains([domain]);

    expect(Object.keys(domainRecordList)).to.contain(domain);

    const recordDataNames: Array<string> = domainRecordList[domain].map((recordDataEntry: RecordData): string => {
      return recordDataEntry.name.toLowerCase();
    });

    // At least the data of the synced records should be existing
    expect(domainRecordList[domain].length).to.be.greaterThan(records.length - 1);
    for (const record of records) {
      expect(recordDataNames).to.contain(record.name.toLowerCase());
    }

    // Cleanup
    recordsToCleanUp.push(...records);
    // Cleanup END
  });
});

function getRandomIp(): string {
  return `${getRandomNumber()}.${getRandomNumber()}.${getRandomNumber()}.${getRandomNumber()}`;
}

function getRandomNumber(): number {
  return Math.floor(Math.random() * 9) + 1;
}
