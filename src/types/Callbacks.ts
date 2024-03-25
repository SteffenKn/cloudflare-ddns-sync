import Cloudflare from 'cloudflare';

export type MultiSyncCallback = (syncResult: Cloudflare.DNS.DNSRecord[]) => void;
