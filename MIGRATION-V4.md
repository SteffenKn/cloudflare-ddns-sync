# Migrating from v3 to v4

v4 replaces the class-based API with `createDdns()` and consolidates related methods. Node.js 20 remains the minimum requirement.

## Initialization

```ts
// v3
const ddns = new CloudflareDDNSSync({token});

// v4
const ddns = createDdns({token, records: ['home.example.com']});
```

If `token` is omitted, v4 reads `CLOUDFLARE_API_TOKEN`. `email`/`key` and user service keys remain supported.

## Synchronizing

```ts
// v3
await ddns.syncRecord({name: 'home.example.com'});
await ddns.syncRecords(records, '203.0.113.10');

// v4
await ddns.sync('home.example.com');
await ddns.sync(records, {ipv4: '203.0.113.10'});
await ddns.sync({ipv4: '203.0.113.10'}); // configured records
```

`sync()` always returns an array. For a single record, use the first entry: `const [record] = await ddns.sync('home.example.com')`.

For configured records, pass fixed addresses directly as the first argument. The former placeholder form `sync(undefined, {ipv4})` remains supported for compatibility.

A and AAAA records automatically use the matching IP family. Non-IP records now require explicit `content`.

## Scheduling and watching

```ts
// v3
const task = ddns.syncByCronTime('*/5 * * * *', records, callback);
const id = await ddns.syncOnIpChange(records, callback);
ddns.stopSyncOnIpChange(id);

// v4
const task = ddns.schedule('*/5 * * * *', {records, onSync: callback});
const watcher = await ddns.watch({records, onSync: callback});
await watcher.stop();
```

`schedule()` and `watch()` return a `SyncJob` with `run()`, `start()` and `stop()`. A v4 job replaces both the listener ID and the direct `node-cron` return value.

## Listing, removing and retrieving IPs

| v3 | v4 |
| --- | --- |
| `getRecordDataForRecord(record)` | `list({records: record})` |
| `getRecordDataForRecords(records)` | `list({records})` |
| `getRecordDataForDomain(domain)` | `list({domains: domain})` |
| `getRecordDataForDomains(domains)` | `list({domains, groupBy: 'domain'})` |
| `removeRecord(name, type?)` | `remove(name)` oder `remove({name, type})` |
| `getIp()` | `ip()` |
| `getIpv6()` | `ip(6)` |

`list()` without filters uses the configured records. Without that configuration, a filter is required.
