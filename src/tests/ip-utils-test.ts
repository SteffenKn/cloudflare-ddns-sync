// tslint:disable:no-unused-expression
import chai from 'chai';

import IpUtils from '../lib/ip-utils';

const expect: Chai.ExpectStatic = chai.expect;
const ipRegex: RegExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;

describe('IPUtils', (): void => {
  describe('Get IP', (): void => {
    it('should get a valid ip', async(): Promise<void> => {
      const ip: string = await IpUtils.getIp();

      expect(ip).to.be.string;
      expect(ip).to.match(ipRegex);
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
      const currentIp: string = await IpUtils.getIp();
      // Prepare END

      const changeListenerId: string = await IpUtils.addIpChangeListener((ip: string): void => {
        expect(ip).to.be.string;
        expect(ip).to.match(ipRegex);
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
