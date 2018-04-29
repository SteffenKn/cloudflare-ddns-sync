'use strict';
const wimIp = require('what-is-my-ip-address');
const publicIp = require('public-ip');

let ipChangeInterval;

function getIp() {
  let ip;
  try {
    ip = publicIp.v4();
  } catch(error) {
    ip = wimIp.v4();
  }

  return ip;
}

function onIpChange(ddnsSync, callback) {
  if(ipChangeInterval) {
    console.error('Cloudflare-DDNS-Sync is already syncing on ip change. You do not need to call this multiple times.'); // eslint-disable-line
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
