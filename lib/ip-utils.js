'use strict';
const wimIp = require('what-is-my-ip-address');
const publicIp = require('public-ip');

let ipChangeInterval = null;

async function getIp() {
  try {
    return await publicIp.v4()
  } catch (error) {
    return await wimIp.v4();
  }
}

function onIpChange(ddnsSync, callback) {
  const ipChangeIntervalIsExisting = ipChangeInterval !== null;
  if (ipChangeIntervalIsExisting) {
    console.error('Cloudflare-DDNS-Sync is already syncing on ip change. You do not need to call this multiple times.'); // eslint-disable-line

    return;
  }

  ipChangeInterval = setInterval(async () => {
    const currentIp = await getIp();
    const recordIps = await ddnsSync.getRecordIps();
    
    for (const recordIp of recordIps) {
      const recordIpMustBeUpdated = currentIp !== recordIp;
      if (recordIpMustBeUpdated) {
        callback(currentIp);

        break;
      }
    }
  }, 10000);
}

function stopOnIpChange() {
  clearInterval(ipChangeInterval);

  ipChangeInterval = null;
}

module.exports = {
  getIp,
  onIpChange,
  stopOnIpChange
}
