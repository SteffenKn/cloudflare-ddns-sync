import {publicIpv4, publicIpv6} from 'public-ip';

export default class IPUtils {
  private static readonly ipPollingDelay = 10 * 1000;

  private static ipChangeEventListeners: Map<string, NodeJS.Timeout> = new Map();

  public static async getIpv4(): Promise<string> {
    /* c8 ignore start*/
    try {
      return await publicIpv4();
    } catch (error) {
      return publicIpv4();
    }

    /* c8 ignore stop*/
  }

  public static async getIpv6(): Promise<string> {
    /* c8 ignore start */

    try {
      return await publicIpv6();
    } catch (error) {
      return publicIpv6();
    }

    /* c8 ignore stop*/
  }

  public static async addIpChangeListener(callback: Function): Promise<string> {
    const eventListenerId = this.getId();

    let previousIp = await this.getIpv4();

    /* c8 ignore start */
    const intervalId = setInterval(async (): Promise<void> => {
      const currentIp = await this.getIpv4();

      const ipMustBeUpdated = currentIp !== previousIp;
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
    const eventListenerIntervalId = this.ipChangeEventListeners.get(eventListenerId);

    clearInterval(eventListenerIntervalId);

    IPUtils.ipChangeEventListeners.delete(eventListenerId);
  }

  private static getId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
