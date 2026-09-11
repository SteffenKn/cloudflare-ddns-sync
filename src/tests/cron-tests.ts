import {expect} from 'chai';

import {createDdns, DdnsError} from '../index.js';
import cron from '../lib/cron.js';

describe('Cron Handler', (): void => {
  describe('Validate Cron Expressions', (): void => {
    it('"* * * * *" should be valid"', (): void => {
      const result = cron.isValid('* * * * *');

      expect(result).to.be.true;
    });

    it('"1 2 3 4 5" should be valid"', (): void => {
      const result = cron.isValid('1 2 3 4 5');

      expect(result).to.be.true;
    });

    it('"* * * * * *" should be valid"', (): void => {
      const result = cron.isValid('* * * * * *');

      expect(result).to.be.true;
    });

    it('"1 2 3 4 5 6" should be valid"', (): void => {
      const result = cron.isValid('1 2 3 4 5 6');

      expect(result).to.be.true;
    });

    it('"test" should not be valid"', (): void => {
      const result = cron.isValid('test');

      expect(result).to.be.false;
    });

    it('"1 2 3 4 5 a" should not be valid"', (): void => {
      const result = cron.isValid('1 2 3 4 5 a');

      expect(result).to.be.false;
    });
  });

  describe('Schedule Cron Expressions', (): void => {
    it('should reject invalid v4 configuration before starting a job', async (): Promise<void> => {
      expect(() => createDdns({token: 'test-token', records: ['']})).to.throw(DdnsError, 'records[0].name');

      const ddns = createDdns({token: 'test-token', records: []});
      try {
        await ddns.list({records: [], domains: []} as never);
        expect.fail('Expected list to reject conflicting filters.');
      } catch (error) {
        expect(errorMessage(error)).to.contain('either records or domains');
      }
      try {
        await ddns.watch({intervalMs: 0});
        expect.fail('Expected watch to reject an invalid interval.');
      } catch (error) {
        expect(errorMessage(error)).to.contain('intervalMs');
      }
    });

    it('should create a v4 sync job', async (): Promise<void> => {
      const ddns = createDdns({token: 'test-token', records: []});
      const job = ddns.schedule('*/1 * * * * *');

      await job.stop();
    });

    it('should run and stop v4 jobs', async (): Promise<void> => {
      const ddns = createDdns({token: 'test-token', records: ['home.example.com']});
      const sync = async (): Promise<Array<never>> => [];
      const ip = async (): Promise<string> => '1.2.3.4';
      (ddns as unknown as {sync: typeof sync}).sync = sync;
      (ddns as unknown as {ip: typeof ip}).ip = ip;

      const scheduled = ddns.schedule('*/1 * * * * *');
      expect(await scheduled.run()).to.deep.equal([]);
      await scheduled.stop();

      const watching = await ddns.watch();
      await watching.stop();
    });

    it('should schedule "*/1 * * * * *"', (done: Function): void => {
      try {
        const scheduledTask = cron.createCronJob('*/1 * * * * *', (): void => {
          scheduledTask.stop();

          done();
        });
      } catch (error) {
        done(`Error scheduling "*/1 * * * * *": ${error}`);
      }
    });

    it('should not schedule "*/2 * * * * a"', (done: Function): void => {
      try {
        cron.createCronJob('*/2 * * * * a', (): void => {
          // This should never be called, because the cron expression is invalid
        });

        done('Error: "*/2 * * * * a" was scheduled.');
      } catch (error) {
        expect(errorMessage(error)).to.contain('is not a valid cron expression.');
        done();
      }
    });
  });
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
