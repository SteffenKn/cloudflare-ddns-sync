import {RecordTypes} from '../index.js';

export type DnsRecord = {
  id: string;
  type: RecordTypes;
  name: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
  zone_id: string;
  zone_name: string;
  modified_on: string;
  created_on: string;
  meta: RecordMetaData;
};

/** @deprecated Use DnsRecord. */
export type RecordData = DnsRecord;

export type RecordMetaData = {
  auto_added: boolean;
  managed_by_apps: boolean;
  managed_by_argo_tunnel: boolean;
};
