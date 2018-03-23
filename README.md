# Cloudflare-DDNS-Sync

## Overview

Cloudflare-DDNS-Sync is a simple Node.js module that updates the IP address of Cloudflare DNS records.

## What are the goals of this project?

The goal of Cloudflare-DDNS-Sync is to make updating the IP of Cloudflare DNS records as easy as possible.


## How do I set this project up?

### Prerequesites

- Node
- Cloudflare Account

### Installation

To use Cloudflare-DDNS-Sync simply run:

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
  for(const result of results){
    console.log(result);
  }
});
```

## Methods

### ddnsSync.sync(\<ip>)

Updates the Ip of the DNS records

#### Parameters:

  * `ip` *The Ip which should be set in the DNS records* [string] **Optional.**

#### Returns:

  * `results` *The results of changing the DNS records* [Array\<Promise\<string>>]

```javascript
ddnsSync.sync()
.then((results) => {
  for(const result of results){
    console.log(result); // "Successfully changed the content of [subdomain.your-domain.com] to [0.0.0.0]"
  }
});
```

### ddnsSync.getIp()

Returns the external Ip

#### Returns:

  * `ip` *The external IP* [Promise\<string>>]

```javascript
ddnsSync.getIp()
.then((ip) => {
  console.log(`Your Ip is ${ip}`); // "Your Ip is 0.0.0.0"
});
```

## Get Your Cloudflare Api Key

- Go to https://www.cloudflare.com
- Log In
- In the upper right corner: click on your email address
- Go to `"My Profile"`
- In the `"API Key"`-Section: click on the `"View API Key"`-Button of the Global Key
- Enter your password and fill the captcha

## Relevant URLs

* https://www.npmjs.com/package/cloudflare - cloudflare
* https://www.npmjs.com/package/colors - colors
* https://www.npmjs.com/package/what-is-my-ip-address - what-is-my-ip-address
