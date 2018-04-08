'use strict';
const wimIp = require('what-is-my-ip-address');

let ipChangeInterval;

function getIp() {
  return wimIp.v4();
}

function onIpChange(ddnsSync, callback) {
  if(ipChangeInterval) {
    console.error('Cloudflare-DDNS-Sync is already syncing on ip change. You do not need to call this multiple times.');
    return;
  }

  setInterval(async () => {
    const currentIp = await getIp();
    const recordIps = await ddnsSync.getRecordIps();
    
    for(const recordIp of recordIps) {
      if(currentIp !== recordIp) {
        callback(currentIp);
        break;
      }
    }
  }, 10000);
}

function stopOnIpChange() {
  clearTimeout(ipChangeInterval);
  ipChangeInterval = null;
}

module.exports = {
  getIp,
  onIpChange,
  stopOnIpChange
}
