import minimist, {ParsedArgs} from 'minimist';

import testConfig from './test-data.json' with {type: 'json'};

import {Auth, Record} from '../../types/index.js';

/* c8 ignore next 100 */
export default class TestService {
  public static getTestData(): TestData {
    const args: ParsedArgs = minimist(process.argv.slice(2));

    const email = args.email ? args.email : testConfig.auth.email;
    const key = args.key ? args.key : testConfig.auth.key;
    const token = args.token ? args.token : testConfig.auth.token;
    const domain = args.domain ? args.domain : testConfig.domain;

    const hasApiToken = Boolean(token && token !== 'your_cloudflare_api_token');
    const hasGlobalApiKey = Boolean(email && email !== 'your@email.com' && key && key !== 'your_cloudflare_api_key');
    const testDataNotProvided = (!hasApiToken && !hasGlobalApiKey) || !domain || domain === 'yourdomain.com';

    if (testDataNotProvided) {
      console.error(
        'Provide a Cloudflare API token or email and global API key via \'src/tests/test-service/test-data.json\' or npm test -- --token="token" --domain="domain.com".',
      );

      process.exit(1);
    }

    const testData: TestData = {
      auth: hasApiToken ? {token} : {email, key},
      domain: domain,
      records: this.getRandomRecords(5, domain),
    };

    return testData;
  }

  private static getRandomRecords(amount: number, domain: string): Array<Record> {
    const records: Array<Record> = [];

    for (let index = 0; index < amount; index++) {
      const record: Record = {
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
