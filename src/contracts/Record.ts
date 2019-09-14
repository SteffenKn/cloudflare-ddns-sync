export type Record = {
  name: string;
  type?: string;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
  content?: string;
};
