# Cloudflare-DDNS-Sync

## Overview

Cloudflare-DDNS-Sync is a simple Node.js module that updates the IP address of Cloudflare DNS records.

## What are the goals of this project?

The goal of Cloudflare-DDNS-Sync is to make updating the IP of Cloudflare DNS records as easy as possible.


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

```javascript
var CloudflareDDNSSync = require("cloudflare-ddns-sync");

var ddnsSync = new CloudflareDDNSSync({
  "auth" : {
    "email"  : "your@email.com",
    "key"  : "your_cloudflare_api_key"
  },
  "domain": "your-domain.com",
  "records" : [
    "subdomain.your-domain.com",
    "subdomain2.your-domain.com"
  ],
});

ddnsSync.sync()
.then((results) => {
  for(var result of results){
    console.log(result);
  }
});
```

## Methods

### ddnsSync.getIp()

- Returns the external IP

#### Returns:

  * *The external IP* [Promise\<string>]

```javascript
ddnsSync.getIp()
.then((ip) => {
  console.log(`Your IP is ${ip}`); // "Your IP is 0.0.0.0"
});
```

### ddnsSync.sync(\<ip>)

- Updates the IP of the DNS records
- When the IP parameter is not set, it will automatically use the external IP

#### Parameters:

- `ip` *The IP which should be set in the DNS records* [string] **Optional.**

#### Returns:

- *The results of changing the DNS records* [Array\<Promise\<string>>]

```javascript
ddnsSync.sync()
.then((results) => {
  for(var result of results){
    console.log(result); // "Successfully changed the IP of [subdomain.your-domain.com] to [0.0.0.0]"
  }
});
```

### ddnsSync.syncByInterval(interval, \<ip>, \<callback>)

- Updates the IP of the DNS records in the given interval
- When the IP parameter is not set, it will automatically use the external IP

#### Parameters:

- `interval` *The interval in which the sync function gets called* [seconds, \<minutes>, \<hours>, \<day of month>, \<months>, \<day of week>]
- `ip` *The IP which should be set in the DNS records* [string] **Optional**
- `callback` *The callback which should get called when the syncing is done* [function] **Optional**

#### Returns:

- *The cronjob which handles the sync function* [CronJob]

```javascript
ddnsSync.syncByInterval([30, 29, 12], "0.0.0.0", async (response) => {  // syncs everyday on 12:29:30
  var results = await response;
  for(var result of results){
    console.log(result);
    // Successfully changed the IP of [your.domain] to [0.0.0.0]
    // Successfully changed the IP of [subdomain.your.domain] to [0.0.0.0]
  }
});
```

### ddnsSync.syncOnceEveryHour(minute, \<ip>, \<callback>)

- Updates the IP of the DNS records every hour at the given minute
- When the IP parameter is not set, it will automatically use the external IP

#### Parameters:

- `minute` *The minute at which the sync function gets called every hour* [number]
- `ip` *The IP which should be set in the DNS records* [string] **Optional**
- `callback` *The callback which should get called when the syncing is done* [function] **Optional**

#### Returns:

- *The cronjob which handles the sync function* [CronJob]

```javascript
ddnsSync.syncOnceEveryHour(15, "0.0.0.0", async (response) => {  // syncs 15 minutes after every full hour
  var results = await response;
  for(var result of results){
    console.log(result);
    // Successfully changed the IP of [your.domain] to [0.0.0.0]
    // Successfully changed the IP of [subdomain.your.domain] to [0.0.0.0]
  }
});
```

### ddnsSync.syncOnceEveryDay([hour, <minute>], \<ip>, \<callback>)

- Updates the IP of the DNS records every day at the given time
- Default minute is 0
- When the IP parameter is not set, it will automatically use the external IP

#### Parameters:

- `hour, minute` *The time at which the sync function gets called every day* [Array\<number>] **Necessary, Optional**
- `ip` *The IP which should be set in the DNS records* [string] **Optional**
- `callback` *The callback which should get called when the syncing is done* [function] **Optional**

#### Returns:

- *The cronjob which handles the sync function* [CronJob]

```javascript
ddnsSync.syncOnceEveryDay([10, 30], "0.0.0.0", async (response) => {  // syncs every day on 10:30
  var results = await response;
  for(var result of results){
    console.log(result);
    // Successfully changed the IP of [your.domain] to [0.0.0.0]
    // Successfully changed the IP of [subdomain.your.domain] to [0.0.0.0]
  }
});
```

### ddnsSync.syncOnceEveryWeek([dayOfWeek, \<hour>, \<minute>], \<ip>, \<callback>)

- Updates the IP of the DNS records every week at the given day and the given time
- Default hour/minute is 0
- When the IP parameter is not set, it will automatically use the external IP

#### Parameters:

- `dayOfWeek, hour, minute` *The time at which the sync function gets called every week* [Array\<number>] **Necessary, Optional, Optional**
- `ip` *The IP which should be set in the DNS records* [string] **Optional**
- `callback` *The callback which should get called when the syncing is done* [function] **Optional**

#### Returns:

- *The cronjob which handles the sync function* [CronJob]

```javascript
ddnsSync.syncOnceEveryWeek([7, 12, 59], "0.0.0.0", async (response) => {  // syncs every sunday on 12:59
  var results = await response;
  for(var result of results){
    console.log(result);
    // Successfully changed the IP of [your.domain] to [0.0.0.0]
    // Successfully changed the IP of [subdomain.your.domain] to [0.0.0.0]
  }
});
```

### ddnsSync.syncOnceEveryMonth([dayOfMonth, <hour>, <minute>], \<ip>, \<callback>)

- Updates the IP of the DNS records every month at the given day and the given time
- Default hour/minute is 0
- When the IP parameter is not set, it will automatically use the external IP

#### Parameters:

- `dayOfMonth, hour, minute` *The time at which the sync function gets called every month* [Array\<number>] **Necessary, Optional, Optional**
- `ip` *The IP which should be set in the DNS records* [string] **Optional**
- `callback` *The callback which should get called when the syncing is done* [function] **Optional**

#### Returns:

- *The cronjob which handles the sync function* [CronJob]

```javascript
ddnsSync.syncOnceEveryMonth([1, 12, 30], "0.0.0.0", async (response) => {  // syncs every first day of each month on 12:30
  var results = await response;
  for(var result of results){
    console.log(result);
    // Successfully changed the IP of [your.domain] to [0.0.0.0]
    // Successfully changed the IP of [subdomain.your.domain] to [0.0.0.0]
  }
});
```


### ddnsSync.syncByCronTime(cronTime, \<ip>, \<callback>)

- Updates the IP of the DNS records at the given cron time
- When the IP parameter is not set, it will automatically use the external IP

#### Syntax:

- '`*`' to make the sync time independent of this setting
- there need to be these 6 values separated by a space:
```
Seconds: 0-59
Minutes: 0-59
Hours: 0-23
Day of Month: 1-31
Months: 0-11
Day of Week: 0-6 | 0 means sunday
```
- You can also use ranges, like:
```
'00 30 11 * * 1-5'
// syncs every weekday on 11:30
```

[Read more about crontabs syntax](http://crontab.org/)

#### Parameters:

- `cron` *The time at which the sync function gets called* [string>]
- `ip` *The IP which should be set in the DNS records* [string] **Optional**
- `callback` *The callback which should get called when the syncing is done* [function] **Optional**

#### Returns:

- *The cronjob which handles the sync function* [CronJob]

```javascript
ddnsSync.syncByCronTime('* * * * * *', "0.0.0.0", async (response) => {  // syncs every tick
  var results = await response;
  for(var result of results){
    console.log(result);
    // Successfully changed the IP of [your.domain] to [0.0.0.0]
    // Successfully changed the IP of [subdomain.your.domain] to [0.0.0.0]
  }
});
```


### ddnsSync.syncByTimestring(timestring, \<ip>, \<callback>)

- Updates the IP of the DNS records every day at the given time
- When the IP parameter is not set, it will automatically use the external IP

#### Parameters:

- `timestring` *The time at which the sync function gets called every day* [string]
- `ip` *The IP which should be set in the DNS records* [string] **Optional**
- `callback` *The callback which should get called when the syncing is done* [function] **Optional**

#### Returns:

- *The cronjob which handles the sync function* [CronJob]

```javascript
ddnsSync.syncOnceEveryMonth("23:55", "0.0.0.0", async (response) => {  // syncs every day on 23:55
  var results = await response;
  for(var result of results){
    console.log(result);
    // Successfully changed the IP of [your.domain] to [0.0.0.0]
    // Successfully changed the IP of [subdomain.your.domain] to [0.0.0.0]
  }
});
```

## Get Your Cloudflare Api Key

- Go to https://www.cloudflare.com
- Log In
- In the upper right corner: click on your email address
- Go to `"My Profile"`
- In the `"API Key"`-Section: click on the `"View API Key"`-Button of the Global Key
- Enter your password and fill the captcha

## Changelog

### v1.1.0

- ⚡️ Improve Performance of First Sync
- ✨ Add Schedule Functionality
- ✨ Add Eslint
- 🚸 Improve Success Message of Sync Function
- ✅ Add Unittests
- 📝 Fix Typos in README
- 📝 Add Schedule Functions to README

### v1.0.3

- 📄 Add LICENSE
- 📝 Fix Typo in README

### v1.0.2

- 📝 Add "Get Your Cloudflare Api Key"-Section to README

### v1.0.1

- ✨ Add sync Function -> changes the IP of the configured DNS records on cloudflare
- ✨ Add getIp Function -> returns the external IP
