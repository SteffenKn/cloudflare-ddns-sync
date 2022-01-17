/* eslint-disable no-unused-expressions */
// tslint:disable:no-unused-expression
import chai from 'chai';

import IpUtils from '../lib/ip-utils';

const {expect} = chai;
const ipv4Regex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/u;
// eslint-disable-next-line max-len
const ipv6Regex = /^(?:(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){6})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:::(?:(?:(?:[0-9a-fA-F]{1,4})):){5})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){4})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,1}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){3})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,2}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:(?:[0-9a-fA-F]{1,4})):){2})(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,3}(?:(?:[0-9a-fA-F]{1,4})))?::(?:(?:[0-9a-fA-F]{1,4})):)(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,4}(?:(?:[0-9a-fA-F]{1,4})))?::)(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9]))\.){3}(?:(?:25[0-5]|(?:[1-9]|1[0-9]|2[0-4])?[0-9])))))))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,5}(?:(?:[0-9a-fA-F]{1,4})))?::)(?:(?:[0-9a-fA-F]{1,4})))|(?:(?:(?:(?:(?:(?:[0-9a-fA-F]{1,4})):){0,6}(?:(?:[0-9a-fA-F]{1,4})))?::))))$/u;

describe('IPUtils', (): void => {
  describe('Get IP', (): void => {
    it('should get a valid ipv4', async(): Promise<void> => {
      const ip: string = await IpUtils.getIpv4();

      expect(ip).to.be.string;
      expect(ip).to.match(ipv4Regex);
    });

    it.skip('should get a valid ipv6', async(): Promise<void> => {
      const ip: string = await IpUtils.getIpv6();

      expect(ip).to.be.string;
      expect(ip).to.match(ipv6Regex);
    });
  });

  describe('Add IP Change Listener', (): void => {
    const changeListenersToRemove: Array<string> = [];
    after((): void => {
      for (const changeListener of changeListenersToRemove) {
        IpUtils.removeIpChangeListener(changeListener);
      }
    });

    it('should be able to create change listener', async(): Promise<void> => {
      const changeListenerId: string = await IpUtils.addIpChangeListener((): void => {
        // Do nothing
      });

      expect(changeListenerId).to.be.string;

      changeListenersToRemove.push(changeListenerId);
    });

    it('should get the current ip in change listener', async(): Promise<void> => {
      // Prepare
      const currentIp: string = await IpUtils.getIpv4();
      // Prepare END

      const changeListenerId: string = await IpUtils.addIpChangeListener((ip: string): void => {
        expect(ip).to.be.string;
        expect(ip).to.match(ipv4Regex);
        expect(ip).to.equal(currentIp);
      });

      changeListenersToRemove.push(changeListenerId);
    });

    it('should be able to remove a change listener', async(): Promise<void> => {
      // Prepare
      const changeListenerId: string = await IpUtils.addIpChangeListener((): void => {
        // Do nothing
      });
      // Prepare END

      IpUtils.removeIpChangeListener(changeListenerId);

      expect(changeListenerId).to.be.string;
    });
  });
});
