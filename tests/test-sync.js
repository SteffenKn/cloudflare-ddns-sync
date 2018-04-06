'use strict';
const CloudflareDDNSSync = require("../index");
const cloudflare = require('cloudflare');
const auth = require('./auth');
const chai = require('chai'); 
const expect = chai.expect;

const ddnsSync = new CloudflareDDNSSync(auth);
const cf = cloudflare({
  email: auth.auth.email,
  key: auth.auth.key
});
let zoneId = getZoneId();
let recordId = getRecordId();


describe ('Sync Functionality', () => {
  it('sync should return success message', async () => {
    const results = await ddnsSync.sync('1.2.3.4');

    expect(results[0]).to.equal('Successfully changed the IP of ' + `[${auth.records[0]}]`.yellow + ' to ' + `[1.2.3.4]`.green)
  });

  it('the ip of the dns record should be "1.2.3.4"', async () => {
    recordId = await recordId;
    const ddnsIp = await getRecordIps();
    expect(ddnsIp).to.equal('1.2.3.4');
  });
  
  it('the ip of the dns record should become the external ip', async () => {
    const ip = await ddnsSync.getIp();
    await ddnsSync.sync();
    const ddnsIp = await getRecordIps();
    
    expect(ddnsIp).to.equal(ip);
  });

  it('the ip of the dns record becomes updated when the dns record is different to the external ip', async () => {
    const ddnsIp = await getRecordIps();
    const ip = await testSyncOnIpChange();

    expect(ddnsIp).to.equal(ip);
  });
});

async function testSyncOnIpChange() {
  return new Promise((resolve) => {
    ddnsSync.syncOnIpChange();
    
    setTimeout(async () => {
      await ddnsSync.sync('1.2.3.4');
      const ip = await ddnsSync.getIp();
      setTimeout(async () => {
        resolve(ip);
      }, 2000);
    }, 2000);
  });
}

async function getRecordIps() {
  recordId = await recordId;
  return cf.dnsRecords.read(zoneId, recordId).then((response) => {
    return response.result.content;
  })
}

function getZoneId() {
  return cf.zones.browse()
  .then((response) => {
    const zones = response.result;

    for(const zone of zones) {
      if(zone.name === auth.domain) {
        return zone.id;
      }
    }

    return null;
  });
}

async function getRecordId() {
  zoneId = await zoneId;

  return cf.dnsRecords.browse(zoneId)
  .then((response) => {
    const records = response.result;

    for(const record of records) {
      if(auth.records.includes(record.name)) {
        return record.id;
      }
    }
    
    return null;
  });
}
