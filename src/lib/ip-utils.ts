import {publicIpv4, publicIpv6} from 'public-ip';

export default class IPUtils {
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
}
