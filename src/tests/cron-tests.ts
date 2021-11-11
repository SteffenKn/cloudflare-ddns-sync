// tslint:disable:no-unused-expression
import chai from 'chai';
import {ScheduledTask} from 'node-cron';

import cron from '../lib/cron';

const expect: Chai.ExpectStatic = chai.expect;

describe('Cron Handler', (): void => {

  describe('Validate Cron Expressions', (): void => {
    it('"* * * * *" should be valid"', (): void => {
      const result: boolean = cron.isValid('* * * * *');

      expect(result).to.be.true;
    });

    it('"1 2 3 4 5" should be valid"', (): void => {
      const result: boolean = cron.isValid('1 2 3 4 5');

      expect(result).to.be.true;
    });

    it('"* * * * * *" should be valid"', (): void => {
      const result: boolean = cron.isValid('* * * * * *');

      expect(result).to.be.true;
    });

    it('"1 2 3 4 5 6" should be valid"', (): void => {
      const result: boolean = cron.isValid('1 2 3 4 5 6');

      expect(result).to.be.true;
    });

    it('"test" should not be valid"', (): void => {
      const result: boolean = cron.isValid('test');

      expect(result).to.be.false;
    });

    it('"1 2 3 4 5 a" should not be valid"', (): void => {
      const result: boolean = cron.isValid('1 2 3 4 5 a');

      expect(result).to.be.false;
    });
  });

  describe('Schedule Cron Expressions', (): void => {
    it('should schedule "*/1 * * * * *"', (done: Function): void => {
      try {
        const scheduledTask: ScheduledTask = cron.createCronJob('*/1 * * * * *', (): void => {
          done();

          scheduledTask.stop();
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

        done(`Error: "*/2 * * * * a" was scheduled.`);
      } catch (error) {
        expect(error.message).to.contain('is not a valid cron expression.');
        done();
      }
    });
  });
});
