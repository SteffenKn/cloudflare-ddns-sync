import cron, {ScheduledTask} from 'node-cron';

export default class Cron {
  public static createCronJob(cronExpression: string, callback: Function): ScheduledTask {
    const cronExpressionIsInvalid = !this.isValid(cronExpression);
    if (cronExpressionIsInvalid) {
      // eslint-disable-next-line max-len
      throw new Error(`'${cronExpression}' is not a valid cron expression.\nHere you can see how cron expressions work: https://cddnss.knaup.dev/cron-expression-syntax`);
    }

    return cron.schedule(cronExpression, (): void => {
      callback();
    }, undefined);
  }

  public static isValid(cronExpression: string): boolean {
    return cron.validate(cronExpression);
  }
}
