// Keep the public record types independent of SDK additions.
export type RecordTypes = 'A' | 'AAAA' | 'CNAME' | 'HTTPS' | 'TXT' | 'LOC' | 'NS' | 'SPF' | 'CERT' | 'DNSKEY' | 'DS' | 'NAPTR' | 'SMIMEA' | 'SSHFP' | 'SVCB' | 'TLSA';

export type Record = {
  name: string;
  type?: RecordTypes;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
  content?: string;
};
