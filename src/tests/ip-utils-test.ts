import chai from 'chai';

import IpUtils from '../lib/ip-utils';

const expect = chai.expect;
const ipRegex: RegExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;

describe('IPUtils', () => {
  describe('Get IP', () => {
    it('should get a valid ip', async() => {
      const ip: string = await IpUtils.getIp();

      expect(ip).to.be.string;
      expect(ip).to.match(ipRegex);
    });
  });
});
