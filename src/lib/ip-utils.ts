import publicIp from 'public-ip';
import * as wimIp from 'what-is-my-ip-address';

export default class IPUtils {
  private static readonly ipPollingDelay: number = 10 * 1000;

  private static ipChangeEventListeners: Map<string, NodeJS.Timeout> = new Map();

  public static async getIpv4(): Promise<string> {
    try {
      return await publicIp.v4();
      /* c8 ignore start*/
    } catch (error) {
      return wimIp.v4();
    }
    /* c8 ignore stop*/
  }

  public static async getIpv6(): Promise<string> {
    try {
      return await publicIp.v6();
      /* c8 ignore start */
    } catch (error) {
      return wimIp.v6();
    }
    /* c8 ignore stop*/
  }

  public static async addIpChangeListener(callback: Function): Promise<string> {
    const eventListenerId: string = this.getRandomId();

    let previousIp: string = await this.getIpv4();

    const intervalId: NodeJS.Timeout = setInterval(async(): Promise<void> => {
      const currentIp: string = await this.getIpv4();

      const ipMustBeUpdated: boolean = currentIp !== previousIp;
      /* c8 ignore start */
      if (ipMustBeUpdated) {
        previousIp = currentIp;

        callback(currentIp);
      }
      /* c8 ignore stop*/
    }, this.ipPollingDelay);

    this.ipChangeEventListeners.set(eventListenerId, intervalId);

    return eventListenerId;
  }

  public static removeIpChangeListener(eventListenerId: string): void {
    const eventListenerIntervalId: NodeJS.Timeout = this.ipChangeEventListeners.get(eventListenerId);

    clearInterval(eventListenerIntervalId);

    IPUtils.ipChangeEventListeners.delete(eventListenerId);
  }

  private static getRandomId(): string {
    const beginningRandomString: string = Math.random().toString(36).substr(2);
    const currentDateAsString: string = new Date().valueOf().toString(36);
    const endingRandomString: string = Math.random().toString(36).substr(2);

    const randomString: string = beginningRandomString + currentDateAsString + endingRandomString;

    return randomString;
  }
}
