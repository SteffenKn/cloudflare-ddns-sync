# Cloudflare-DDNS-Sync

[![NPM](https://nodei.co/npm/cloudflare-ddns-sync.png)](https://nodei.co/npm/cloudflare-ddns-sync/)

[Documentation](https://cds.knaup.pw/)

## Overview

Cloudflare-DDNS-Sync is a simple NPM package that updates the IP address of Cloudflare DNS records.

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

- getIp()
- sync(\<ip>)
- syncOnIpChange(\<callback>)
- syncByInterval(interval, \<ip>, \<callback>)
- syncOnceEveryHour(minute, \<ip>, \<callback>)
- syncOnceEveryDay([hour, \<minute>], \<ip>, \<callback>)
- syncOnceEveryWeek([dayOfWeek, \<hour>, \<minute>], \<ip>, \<callback>)
- syncOnceEveryMonth([dayOfMonth, \<hour>, \<minute>], \<ip>, \<callback>)
- syncByCronTime(cronTime, \<ip>, \<callback>)
- syncAtDate(date, \<ip>, \<callback>)
- syncByTimestring(timestring, \<ip>, \<callback>)

For a more detailed view, have a look at the [Documentation](https://cds.knaup.pw/methods.html)

## Get Your Cloudflare API Key

- Go to **[Cloudflare](https://www.cloudflare.com)**
- **Log In**
- In the upper right corner: **click on your email address**
- Go to **"My Profile"**
- In the "API Key"-Section: **click on the "View API Key"-Button of the Global Key**
- **Enter your password** and **fill the captcha**
- **Copy the API Key**

## Changelog

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
