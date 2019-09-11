import publicIp from 'public-ip';
import wimIp from 'what-is-my-ip-address';

export default class IPUtils {
  private static readonly ipPollingDelay: number = 10 * 1000;

  private static ipChangeEventListeners: Map<string, NodeJS.Timeout> = new Map();

  public static async getIp(): Promise<string> {
    try {
      return await publicIp.v4();
    } catch (error) {
      return wimIp.v4();
    }
  }

  public static async addIpChangeListener(callback: Function): Promise<string> {
    const eventListenerId: string = this.getRandomId();

    let previousIp: string = await this.getIp();

    const intervalId: NodeJS.Timeout = setInterval(async() => {
      const currentIp: string = await this.getIp();

      const ipMustBeUpdated: boolean = currentIp !== previousIp;
      if (ipMustBeUpdated) {
        previousIp = currentIp;

        callback(currentIp);
      }
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
