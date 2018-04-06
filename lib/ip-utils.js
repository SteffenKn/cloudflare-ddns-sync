'use strict';
const wimIp = require('what-is-my-ip-address');

function getIp() {
  return wimIp.v4();
}

function onIpChange(ddnsSync, callback) {
  setInterval(async () => {
    const currentIp = await getIp();
    const recordIps = await ddnsSync.getRecordIps();
    
    for(const recordIp of recordIps) {
      if(currentIp !== recordIp) {
        callback(currentIp);
        break;
      }
    }
  }, 1000);
}

module.exports = {
  getIp,
  onIpChange
}
