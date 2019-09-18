# Cloudflare-DDNS-Sync

![](https://github.com/SteffenKn/Cloudflare-ddns-sync/workflows/Test-Workflow/badge.svg)

[![NPM](https://nodei.co/npm/cloudflare-ddns-sync.png)](https://www.npmjs.com/package/cloudflare-ddns-sync)
[![NPM](https://nodei.co/npm/cloudflare-ddns-sync-cli.png)](https://www.npmjs.com/package/cloudflare-ddns-sync-cli)


## Overview

Cloudflare-DDNS-Sync is a simple module that updates Cloudflare DNS records.


You may also have a look at the **official** [CLI version](https://www.npmjs.com/package/cloudflare-ddns-sync-cli) of Cloudflare-DDNS-Sync.

## How do I set this project up?

### Prerequisites

- Node
- Cloudflare Account

### Installation

To install Cloudflare-DDNS-Sync simply run:

```
npm install cloudflare-ddns-sync
```

in your project folder.

## Usage

> Hint: If a record is not existing, CDS will automatically create it when
syncing.

### Javascript Example

```javascript
const Cddnss = require('cloudflare-ddns-sync').default;

const cddnss = new Cddnss('your@email.com', '<your-cloudflare-api-key>');

const records = [
  {
    name: 'test-1.domain.com',
    type: 'A',          // optional
    proxied: true,      // optional
    ttl: 1,             // optional
    priority: 0,        // optional
    content: '1.2.3.4', // optional
  },
  {
    name: "test-2.domain.com"
  }
];

cddnss.syncRecords(records).then((result) => {
  console.log(result);
});
```

### Typescript Example

```typescript
import Cddnss, {Record, RecordData} from 'cloudflare-ddns-sync';

const cddnss: Cddnss = new Cddnss('your@email.com', '<your-cloudflare-api-key>');

const records: Array<Record> = [
  {
    name: 'test-1.yourdomain.com',
    type: 'A',          // optional
    proxied: true,      // optional
    ttl: 1,             // optional
    priority: 0,        // optional
    content: '1.2.3.4', // optional
  },
  {
    name: "test-2.yourdomain.com"
  },
];

cddnss.syncRecords(records).then((result: Array<RecordData>) => {
  console.log(result);
});
```

### Cron Expression Syntax

Cron expressions have the following syntax:

```
* * * * * *
┬ ┬ ┬ ┬ ┬ ┬
│ │ │ │ │ │
│ │ │ │ │ └──── weekday (0-7, sunday is 0 or 7)
│ │ │ │ └────── month (1-12)
│ │ │ └──────── day (1-31)
│ │ └────────── hour (0-23)
│ └──────────── minute (0-59)
└────────────── second (0-59) [optional]
```

## Methods

- getIp(): Promise\<string\>
- getRecordDataForDomain(domain: string): Promise\<Array\<[RecordData](https://docu.cddnss.pw/types/recorddata)\>\>
- getRecordDataForDomains(domains: Array\<string\>): Promise\<[DomainRecordList](https://docu.cddnss.pw/types/domainrecordlist)\>
- getRecordDataForRecord(record: [Record](https://docu.cddnss.pw/types/record)): Promise\<[RecordData](https://docu.cddnss.pw/types/recorddata)\>
- getRecordDataForRecords(records: Array\<[Record](https://docu.cddnss.pw/types/record)\>): Promise\<Array\<[RecordData](https://docu.cddnss.pw/types/recorddata)\>\>
- removeRecord(recordName: string): Promise\<void\>
- stopSyncOnIpChange(changeListenerId: string): void
- syncByCronTime(cronExpression: string, records: Array\<[Record](https://docu.cddnss.pw/types/recorddata)\>, callback: [MultiSyncCallback](https://docu.cddnss.pw/types/multisynccallback), ip?: string): [ScheduledTask](https://www.npmjs.com/package/node-cron#scheduledtask-methods)
- syncOnIpChange(records: Array\<[Record](https://docu.cddnss.pw/types/record)\>, callback: multisynccallback): Promise\<string\>
- syncRecord(record: [Record](https://docu.cddnss.pw/types/record), ip?: string): Promise\<[RecordData](https://docu.cddnss.pw/types/recorddata)\>
- syncRecords(records: Array\<[Record](https://docu.cddnss.pw/types/record)\>, ip?: string): Promise\<Array\<[RecordData](https://docu.cddnss.pw/types/recorddata)\>\>

For a more detailed view, have a look at the [Documentation](https://docu.cddnss.pw/)

## Get Your Cloudflare API Key

- Go to **[Cloudflare](https://www.cloudflare.com)**
- **Log In**
- In the upper right corner: **click on the user icon**
- Go to **"My Profile"**
- In the "API Tokens"-Section: **click on the "View"-Button of the Global Key**
- **Enter your password** and **fill the captcha**
- **Copy the API Key**

## Tests

In order to run the tests there are two ways to do so

### Use `test-data.json`

- Open the `test-data.json` which can be found under `src/tests/test-service/`
- Configure the email, cloudflare api key and the domain
- Run `npm test`

### Use `npm test` Only

- Run `npm test -- --email="your@email.com" --key="your_cloudflare_api_key" --domain="yourdomain.com"`

## Changelog

### v2.0.0

- ♻️ **Rewrite Cloudflare-DDNS-Sync in Typescript**

### v1.5.4

- 📝 Update README

### v1.5.3

- 🐛 **Fix Stopping Sync On IP Change**
- 🐛 **Fix Crontime Converter For Hour**
- 🐛 **Fix Syncing With Crontime Without Setting an IP**
- ⚡️ **Small Performance Improvements**
- 💄 Improve Code Quality
- 💄 Extract Business Rules

### v1.5.2

- 🐛 Fix Wrong Using of Const

### v1.5.1

- 🐛 **Fix Bug When 'public-ip' Throws An Error**
- 💄 Improve Code Quality

### v1.5.0

- ✨ **Add Create Not Existing Records Functionality**
- ✨ **Add Fallback getIp Function**

### v1.4.0

- ✨ **Add Stop SyncOnIpChange Function**

### v1.3.4

- 🐛 **Fix ipChange Interval**

### v1.3.3

- 📝 **Add Changelog**

### v1.3.2

- ✨ **Add getRecordIps Function**
- ♻️ **Refactor syncOnIpChange**
- ✅ **Add Tests for Sync Functionality**
- 📝 **Improve README**
- 📝 **Add NPM Badge**
- 🔥 Remove Unnecessary Code
- 🚸 Update Description
- 🎨 Order Dependencies
- 🎨 Lint files

### v1.3.1

- 📝 **Fix README**

### v1.3.0

- ✨ **Add syncAtDate Function**
- 📝 **Improve README**

### v1.2.1

- 🚑 **Fix README**

### v1.2.0

- ✨ **Add onIpChange Function**
- 📝 **Adjust README**
- 🚚 Move Utils to Lib
- 🚚 Move IP Functions to Lib
- 🚚 Move Dependencies to devDependencies
- 🔧 Update Eslint Config
- 🎨 Fix Eslit Error

### v1.1.0

- ⚡️ **Improve Performance of First Sync**
- ✨ **Add Schedule Functionality**
- 🚸 **Improve Success Message of Sync Function**
- 📝 **Fix Typos in README**
- 📝 **Add Schedule Functions to README**
- ✅ Add Unittests
- ✨ Add Eslint

### v1.0.3

- 📝 **Fix Typo in README**
- 📄 Add LICENSE

### v1.0.2

- 📝 **Add "Get Your Cloudflare Api Key"-Section to README**

### v1.0.1

- ✨ **Add sync Function -> changes the IP of the configured DNS records on Cloudflare**
- ✨ **Add getIp Function -> returns the external IP**
- 📝 **Add README**
