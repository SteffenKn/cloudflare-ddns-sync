import {DnsRecord, Record} from '../types/index.js';

export class SyncError extends Error {
  public constructor(
    public readonly succeeded: Array<DnsRecord>,
    public readonly failed: Array<{record: Record; error: Error}>,
  ) {
    super('One or more DNS records could not be synchronized.');
    this.name = 'SyncError';
  }
}
