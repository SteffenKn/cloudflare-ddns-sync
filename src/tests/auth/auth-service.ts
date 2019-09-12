import minimist, {ParsedArgs} from 'minimist';

import authConfig from './auth.json';

import {IRecord} from '../../contracts/index.js';

export default class AuthService {
  public static getAuthData(): AuthData {
    const args: ParsedArgs = minimist(process.argv.slice(2));

    const authData: AuthData = Object.assign({}, authConfig);

    const email: string | undefined = args.email;
    const key: string | undefined = args.key;
    const recordsAsString: string | undefined = args.records;

    authData.auth.email = email ? email : authData.auth.email;
    authData.auth.key = key ? key : authData.auth.key;

    try {
      const records: Array<IRecord> = JSON.parse(recordsAsString).records;

      authData.records = records;
    } catch {
      // Do nothing
    }

    return authData;
  }
}

export type AuthData = {
  auth: {
    email: string,
    key: string,
  },
  records: Array<IRecord>,
};
