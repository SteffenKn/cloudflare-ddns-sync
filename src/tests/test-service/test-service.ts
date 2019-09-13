import minimist, {ParsedArgs} from 'minimist';

import testConfig from './test-data.json';

import {IRecord} from '../../contracts/index.js';

export default class TestService {
  public static getTestData(): TestData {
    const args: ParsedArgs = minimist(process.argv.slice(2));

    const testData: TestData = Object.assign({}, testConfig);

    const email: string | undefined = args.email;
    const key: string | undefined = args.key;
    const recordsAsString: string | undefined = args.records;

    testData.auth.email = email ? email : testData.auth.email;
    testData.auth.key = key ? key : testData.auth.key;

    try {
      const records: Array<IRecord> = JSON.parse(recordsAsString).records;

      testData.records = records;
    } catch {
      // Do nothing
    }

    return testData;
  }
}

export type TestData = {
  auth: {
    email: string,
    key: string,
  },
  records: Array<IRecord>,
};
