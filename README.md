# Cloudflare DDNS Sync

Cloudflare DDNS Sync synchronizes DNS records with the current public IP address. Version 4 provides a small, DDNS-oriented API.

## Voraussetzungen

- Node.js 20 or newer
- A Cloudflare API token with permission to read zones and edit DNS records

```sh
npm install cloudflare-ddns-sync
```

## Einstieg

Set `CLOUDFLARE_API_TOKEN` and configure the hostnames once:

```ts
import {createDdns} from 'cloudflare-ddns-sync';

const ddns = createDdns({
  records: ['home.example.com', {name: 'app.example.com', proxied: true}],
});

await ddns.sync();
```

A string represents an A record. Missing A and AAAA records are created; existing records with the same name and type are updated. A records automatically receive the public IPv4 address, and AAAA records receive the IPv6 address.

```ts
const ddns = createDdns({
  token: process.env.CLOUDFLARE_API_TOKEN,
  records: [
    'home.example.com',
    {name: 'home.example.com', type: 'AAAA'},
    {name: 'alias.example.com', type: 'CNAME', content: 'home.example.com'},
  ],
});

await ddns.sync();
```

Explicit `token`, `email`/`key` and user service keys remain supported. If no credentials are provided, only `CLOUDFLARE_API_TOKEN` is used.

## Synchronizing

```ts
await ddns.sync();
await ddns.sync('temporary.example.com');
await ddns.sync(['home.example.com', {name: 'vpn.example.com', proxied: true}]);

await ddns.sync({
  ipv4: '203.0.113.10',
  ipv6: '2001:db8::1',
});
```

`sync()` always returns an array of updated DNS records. Explicit `content` on a record takes precedence. Record types other than A and AAAA require `content`.

## Scheduling and IP watching

```ts
const scheduled = ddns.schedule('*/5 * * * *');
await scheduled.stop();

const watching = await ddns.watch({
  onError: error => console.error(error),
});

await watching.stop();
```

`schedule()` starts immediately and synchronizes at the next cron interval. `watch()` synchronizes first and then watches only the required IP families; the default interval is ten seconds. Fixed addresses and records with explicit `content` are not polled. Both return a job with `run()`, `start()` and `stop()` methods. Errors from `run()` reject its promise; automatic runs call `onError` once.

Configuration errors are `DdnsError`s with `code: 'INVALID_CONFIG'`; errors while looking up a public address have `code: 'IP_UNAVAILABLE'`.

## Listing and removing records

```ts
const records = await ddns.list({records: 'home.example.com'});
const ipv6Records = await ddns.list({records: {name: 'home.example.com', type: 'AAAA'}});
const domainRecords = await ddns.list({domains: 'example.com'});
const grouped = await ddns.list({domains: ['example.com', 'example.org'], groupBy: 'domain'});

await ddns.remove('home.example.com');
await ddns.remove({name: 'home.example.com', type: 'AAAA'});
```

`remove('name')` removes an A record. Use a record object for other types. `list()` without filters uses the records configured when creating the DDNS instance. A record filter with `type` returns only that DNS type.

## Public IP

```ts
const ipv4 = await ddns.ip();
const ipv6 = await ddns.ip(6);
```

## Migrating from v3

v4 is a breaking release. See [MIGRATION-V4.md](./MIGRATION-V4.md) for the complete mapping of the previous API.

## Tests

The integration tests create and remove records in a Cloudflare test zone:

```sh
npm test -- --token="$CLOUDFLARE_API_TOKEN" --domain="example.com"
```
