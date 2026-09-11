import {expect} from 'chai';

import {createDdns, Ddns} from '../index.js';
import IPUtils from '../lib/ip-utils.js';
import TestService from './test-service/test-service.js';

import {Record, RecordData} from '../types/index.js';

const cloudflareClient: Ddns = createDdns(TestService.getTestData().auth);

const recordsToCleanUp: Array<Record> = [];

describe('Cloudflare Client', (): void => {
  afterEach(async (): Promise<void> => {
    while (recordsToCleanUp.length > 0) {
      const record = recordsToCleanUp.pop();
      if (!record) {
        continue;
      }
      await cloudflareClient.remove({name: record.name, type: record.type || 'A'});
    }
  });

  it('should be able to create a record', async (): Promise<void> => {
    // Prepare
    const record = TestService.getTestData().records.shift();
    record.content = '1.2.3.4';
    // Prepare END

    const createdRecord = await syncRecord(record);

    const expectedRecordType = record.type ? record.type : 'A';

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

  it('should be able to create an IPv6 record', async (): Promise<void> => {
    // Prepare
    const record = TestService.getTestData().records.shift();
    record.type = 'AAAA';
    record.content = '2001:db8::1';
    // Prepare END

    const createdRecord = await syncRecord(record);

    expect(createdRecord.type).to.equal('AAAA');
    expect(createdRecord.content).to.equal('2001:db8::1');

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should filter records by name and type', async (): Promise<void> => {
    // Prepare
    const record = TestService.getTestData().records.shift();
    const ipv4Record: Record = {...record, type: 'A', content: '1.2.3.4'};
    const ipv6Record: Record = {...record, type: 'AAAA', content: '2001:db8::1'};
    await cloudflareClient.sync([ipv4Record, ipv6Record]);
    // Prepare END

    const records = await cloudflareClient.list({records: {name: record.name, type: 'AAAA'}});

    expect(records).to.have.length(1);
    expect(records[0].type).to.equal('AAAA');

    // Cleanup
    recordsToCleanUp.push(ipv4Record, ipv6Record);
    // Cleanup END
  });

  it('should be able to remove a record', async (): Promise<void> => {
    // Prepare
    const record = TestService.getTestData().records.shift();
    record.content = '1.2.3.4';
    await syncRecord(record);
    // Prepare END

    await cloudflareClient.remove(record.name);
  });

  it('should get record data for records', async (): Promise<void> => {
    // Prepare
    const {records} = TestService.getTestData();
    await cloudflareClient.sync(records, {ipv4: '1.2.3.4'});
    // Prepare END

    const recordData = (await cloudflareClient.list({records})) as Array<RecordData>;

    const recordDataNames = recordData.map((recordDataEntry: RecordData): string => recordDataEntry.name.toLowerCase());

    expect(recordData.length).to.equal(records.length);

    for (const record of records) {
      expect(recordDataNames).to.contain(record.name.toLowerCase());
    }

    // Cleanup
    recordsToCleanUp.push(...records);
    // Cleanup END
  });

  it('should sync existing record', async (): Promise<void> => {
    // Prepare
    const record = TestService.getTestData().records.shift();
    await syncRecord(record);
    // Prepare END

    const recordData = await syncRecord(record);

    expect(recordData.name.toLowerCase()).to.equal(record.name.toLowerCase());

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should sync multiple records', async (): Promise<void> => {
    // Prepare
    const {records} = TestService.getTestData();
    // Prepare END

    const recordData = await cloudflareClient.sync(records);

    const recordDataNames = recordData.map((singleRecordData: RecordData): string => singleRecordData.name.toLowerCase());

    for (const record of records) {
      expect(recordDataNames).to.contain(record.name.toLowerCase());
    }

    // Cleanup
    recordsToCleanUp.push(...records);
    // Cleanup END
  });

  it('should sync with ip via parameter', async (): Promise<void> => {
    // Prepare
    const record = TestService.getTestData().records.shift();
    const randomIp = getRandomIp();
    // Prepare END

    const recordData = await syncRecord(record, randomIp);

    expect(recordData.name.toLowerCase()).to.equal(record.name.toLowerCase());
    expect(recordData.content).to.equal(randomIp);

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should sync with ip via record.content', async (): Promise<void> => {
    // Prepare
    const record = TestService.getTestData().records.shift();
    const randomIp = getRandomIp();
    record.content = randomIp;
    // Prepare END

    const recordData = await syncRecord(record);

    expect(recordData.name.toLowerCase()).to.equal(record.name.toLowerCase());
    expect(recordData.content).to.equal(randomIp);

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should sync with external ip', async (): Promise<void> => {
    // Prepare
    const record = TestService.getTestData().records.shift();
    record.content = undefined;
    const currentIp = await IPUtils.getIpv4();
    // Prepare END

    const recordData = await syncRecord(record);

    expect(recordData.name.toLowerCase()).to.equal(record.name.toLowerCase());
    expect(recordData.content).to.equal(currentIp);

    // Cleanup
    recordsToCleanUp.push(record);
    // Cleanup END
  });

  it('should get record data for domain', async (): Promise<void> => {
    // Prepare
    const testData = TestService.getTestData();
    const {domain} = testData;
    const {records} = testData;
    await cloudflareClient.sync(records, {ipv4: '1.2.3.4'});
    // Prepare END

    const recordData = (await cloudflareClient.list({domains: domain})) as Array<RecordData>;

    const recordDataNames = recordData.map((recordDataEntry: RecordData): string => recordDataEntry.name.toLowerCase());

    // At least the data of the synced records should be existing
    expect(recordData.length).to.be.greaterThan(records.length - 1);
    for (const record of records) {
      expect(recordDataNames).to.contain(record.name.toLowerCase());
    }

    // Cleanup
    recordsToCleanUp.push(...records);
    // Cleanup END
  });

  it('should get record data for multiple domains', async (): Promise<void> => {
    // Prepare
    const testData = TestService.getTestData();
    const {domain} = testData;
    const {records} = testData;
    await cloudflareClient.sync(records, {ipv4: '1.2.3.4'});
    // Prepare END

    const domainRecordList = (await cloudflareClient.list({domains: [domain], groupBy: 'domain'})) as {[domain: string]: Array<RecordData>};

    expect(Object.keys(domainRecordList)).to.contain(domain);

    const recordDataNames = domainRecordList[domain].map((recordDataEntry: RecordData): string => recordDataEntry.name.toLowerCase());

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

async function syncRecord(record: Record, ipv4?: string): Promise<RecordData> {
  const [result] = await cloudflareClient.sync(record, ipv4 ? {ipv4} : {});

  return result;
}

function getRandomNumber(): number {
  return Math.floor(Math.random() * 9) + 1;
}
