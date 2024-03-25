import minimist, {ParsedArgs} from 'minimist';

import testConfig from './test-data.json' assert {type: 'json'};

import {Auth, Record} from '../../types/index.js';

/* c8 ignore next 100 */
export default class TestService {
  public static getTestData(): TestData {
    const args: ParsedArgs = minimist(process.argv.slice(2));

    const cloudflareEmail = args.email ? args.email : testConfig.auth.email;
    const cloudflareApiKey = args.key ? args.key : testConfig.auth.key;
    const cloudflareApiToken = args.token ? args.token : testConfig.auth.token;
    const domain = args.domain ? args.domain : testConfig.domain;

    const testDataNotProvided =
      !cloudflareEmail || cloudflareEmail === 'your@email.com' || !cloudflareApiKey || cloudflareApiKey === 'your_cloudflare_api_key' || !domain || domain === 'yourdomain.com';

    if (testDataNotProvided) {
      console.error(
        'In order to use the tests you must provide some data via \'src/tests/test-service/test-data.json\' or via \'npm test -- --email="your@email.com" --key="cloudflare-key" --domain="domain.com"\'',
      );

      process.exit();
    }

    const testData: TestData = {
      auth: {
        apiEmail: cloudflareEmail,
        apiKey: cloudflareApiKey,
        apiToken: cloudflareApiToken,
      },
      domain: domain,
      records: this.getRandomRecords(5, domain),
    };

    return testData;
  }

  private static getRandomRecords(amount: number, domain: string): Array<Record> {
    const records = [];

    for (let index = 0; index < amount; index++) {
      const record = {
        name: `cddnss-test-${this.getRandomSubdomain()}.${domain}`,
      };

      records.push(record);
    }

    return records;
  }

  private static getRandomSubdomain(): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength: number = characters.length;

    for (let index = 0; index < 5; index++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
  }
}

export type TestData = {
  auth: Auth;
  domain: string;
  records: Array<Record>;
};
