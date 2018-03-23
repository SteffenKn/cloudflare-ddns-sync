const cloudflare = require('cloudflare');
const colors = require('colors');
const wimIp = require('what-is-my-ip-address');

let cf = null;
let cfEmail = null;
let cfKey = null;
let cfDomain = null;
let cfRecords = [];

let cfZoneId = null;
let cfRecordIds = [];

const CloudflareDDNSSync = function(options) {
  if(!options
    ||!options.auth
    || !options.domain
    || !options.records
    || !options.auth.email
    || !options.auth.key
    || !(options.records.length > 0)){

    throw new Error(`You used CloudflareDDNSSync wrong
      Usage: CloudflareDDNSSync({
        "auth" : {
          "email"  : "your@email.com",
          "key"  : "your_cloudflare_api_key"
        },
        "domain": "your-domain.com",
        "records" : [
          "subdomain.your-domain.com",
          "subdomain2.your-domain.com"
        ],
      });`
    );
  }

  cfEmail = options.auth.email;
  cfKey = options.auth.key;
  cfDomain = options.domain;
  cfRecords = options.records;

  cf = cloudflare({
    email: cfEmail,
    key: cfKey
  });
}

async function fetchIds(){
  cfZoneId = await getZoneId();
  cfRecordIds = await getRecordIds();
}

function getZoneId(){
  return cf.zones.browse()
  .then((response) => {
    const zones = response.result;

    for(const zone of zones){
      if(zone.name === cfDomain){
        return zone.id;
      }
    }
  });
}

function getRecordIds(){
  return cf.dnsRecords.browse(cfZoneId)
  .then((response) => {
    const records = response.result;
    const recordIds = [];

    for(const record of records){
      if(cfRecords.includes(record.name)){
        recordIds.push(record.id);
      }
      if(cfRecordIds.length === cfRecords.length){
        break;
      }
    }

    return recordIds;
  });
}

CloudflareDDNSSync.prototype.getIp = function (){
  return wimIp.v4();
}

function getRecord(recordId){
  return cf.dnsRecords.read(cfZoneId, recordId)
  .then((response) => {
    return response.result;
  })
  .catch((error) => {
    return error.message;
  });
}

function setRecord(recordId, record){
  return cf.dnsRecords.edit(cfZoneId, recordId, record)
  .then((response) => {
    const result = response.result;
    const resultString = 'Successfully changed the content of ' + `[${result.name}]`.yellow + ' to ' + `[${result.content}]`.green;
    return resultString;
  })
  .catch((error) => {
    return error.message;
  });
}

function setIpInRecord(record, ip){
  record.content = ip;

  return record;
}

async function updateIpOfRecord(recordId, ip){
  let record = await getRecord(recordId);
  record = setIpInRecord(record, ip);

  const result = await setRecord(recordId, record);
  return result;
}

CloudflareDDNSSync.prototype.sync = async function (ip){
  if(!cfZoneId || !cfRecordIds || cfRecordIds.length <= 0){
    await fetchIds();
  }

  let ipToSync = ip;
  if(!ipToSync){
    ipToSync = await this.getIp();
  }

  const results = [];
  for(const recordId of cfRecordIds){
    const currentResult = updateIpOfRecord(recordId, ipToSync);
    results.push(currentResult);
  }

  return Promise.all(results);
}

module.exports = CloudflareDDNSSync;
