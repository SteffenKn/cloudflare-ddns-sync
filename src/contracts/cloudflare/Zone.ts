export type Zone = {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  development_mode: number;
  name_servers: Array<string>;
  original_name_servers: Array<string>;
  modified_on: Date;
  created_on: Date;
  activated_on: Date;
  meta: {
    step: number,
    wildcard_proxiable: boolean,
    custom_certificate_quota: number,
    page_rule_quota: number,
    phishing_detected: boolean,
    multiple_railguns_allowed: boolean,
  };
  owner: {
    id: string,
    type: string,
    email: string,
  };
  account: {
    id: string,
    name: string,
  };
  permissions: Array<string>;
  plan: {
    id: string,
    name: string,
    price: number,
    currency: string,
    frequency: string,
    is_subscribed: boolean,
    can_subscribe: boolean,
    legacy_id: string,
    legacy_discount: boolean,
    externally_managed: boolean,
  }
};
