import * as wimIp from 'what-is-my-ip-address';
import {publicIpv4, publicIpv6} from 'public-ip';

export default class IPUtils {
  private static readonly ipPollingDelay: number = 10 * 1000;

  private static ipChangeEventListeners: Map<string, NodeJS.Timeout> = new Map();

  public static async getIpv4(): Promise<string> {
    /* c8 ignore start*/
    try {
      return await publicIpv4();
    } catch (error) {
      return wimIp.v4();
    }

    /* c8 ignore stop*/
  }

  public static async getIpv6(): Promise<string> {
    /* c8 ignore start */

    try {
      return await publicIpv6();
    } catch (error) {
      return wimIp.v6();
    }

    /* c8 ignore stop*/
  }

  public static async addIpChangeListener(callback: Function): Promise<string> {
    const eventListenerId: string = this.getRandomId();

    let previousIp: string = await this.getIpv4();

    /* c8 ignore start */
    const intervalId: NodeJS.Timeout = setInterval(async(): Promise<void> => {
      const currentIp: string = await this.getIpv4();

      const ipMustBeUpdated: boolean = currentIp !== previousIp;
      if (ipMustBeUpdated) {
        previousIp = currentIp;

        callback(currentIp);
      }
    }, this.ipPollingDelay);

    /* c8 ignore stop*/

    this.ipChangeEventListeners.set(eventListenerId, intervalId);

    return eventListenerId;
  }

  public static removeIpChangeListener(eventListenerId: string): void {
    const eventListenerIntervalId: NodeJS.Timeout = this.ipChangeEventListeners.get(eventListenerId);

    clearInterval(eventListenerIntervalId);

    IPUtils.ipChangeEventListeners.delete(eventListenerId);
  }

  private static getRandomId(): string {
    return Math.random().toString(36)
      .substring(2, 15) + Math.random().toString(36)
      .substring(2, 15);
  }
}
