export interface IRecord {
  name: string;
  type?: string;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
  content?: string;
}
