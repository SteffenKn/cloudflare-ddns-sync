'use strict';
const cloudflare = require('cloudflare');
const cron = require('cron');
require('colors');
const ctConverter = require('./lib/crontime-converter');
const ipUtil = require('./lib/ip-utils')

const CronJob = cron.CronJob;

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
    || !(options.records.length > 0)) {

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

  cfZoneId = getZoneId();
  cfRecordIds = getRecordIds();
}

function getZoneId() {
  return cf.zones.browse()
  .then((response) => {
    const zones = response.result;

    for(const zone of zones) {
      if(zone.name === cfDomain) {
        return zone.id;
      }
    }

    return null;
  });
}

async function getRecordIds() {
  cfZoneId = await cfZoneId;

  return cf.dnsRecords.browse(cfZoneId)
  .then((response) => {
    const records = response.result;
    const recordIds = [];

    for(const record of records) {
      if(cfRecords.includes(record.name)) {
        recordIds.push(record.id);
      }
      if(cfRecordIds.length === cfRecords.length) {
        break;
      }
    }

    return recordIds;
  });
}

async function getRecordIps() {
  const recordIps = [];

  for(const recordId of cfRecordIds) {
    const currentIp = cf.dnsRecords.read(cfZoneId, recordId).then((response) => {
      return response.result.content;
    });

    recordIps.push(currentIp);
  }

  return Promise.all(recordIps);
}

function getRecord(recordId) {
  return cf.dnsRecords.read(cfZoneId, recordId)
  .then((response) => {
    return response.result;
  })
  .catch((error) => {
    return error.message;
  });
}

function setRecord(recordId, record) {
  return cf.dnsRecords.edit(cfZoneId, recordId, record)
  .then((response) => {
    const result = response.result;
    const resultString = 'Successfully changed the IP of ' + `[${result.name}]`.yellow + ' to ' + `[${result.content}]`.green;
    return resultString;
  })
  .catch((error) => {
    return error.message;
  });
}

async function updateIpOfRecord(recordId, ip) {
  let record = await getRecord(recordId);
  record.content = ip;

  const result = await setRecord(recordId, record);
  return result;
}

function createCronJob(ddnsSync, cronTime, ip, callback) {
  return new CronJob(cronTime, () => {
    const syncResult = ddnsSync.sync(ip);

    if(typeof callback === 'function') {
      callback(syncResult);
    }
  }, null, true);
}

CloudflareDDNSSync.prototype.getIp = ipUtil.getIp;

CloudflareDDNSSync.prototype.getRecordIps = getRecordIps;

CloudflareDDNSSync.prototype.syncOnIpChange = async function (callback) {
  if(cfRecordIds.then !== undefined) {
    cfRecordIds = await cfRecordIds;
  }

  ipUtil.onIpChange(this, (ip) => {
    const result = this.sync(ip);

    if (typeof callback === 'function') {
      callback(result);
    }
  })
}

CloudflareDDNSSync.prototype.syncByInterval = function (interval, ipOrCallback, callback) {
  let ip;
  if(typeof ipOrCallback === 'function') {
    callback = ipOrCallback
  } else {
    ip = ipOrCallback;
  }

  if(interval === undefined) {
    throw new Error('syncByInterval needs an interval');
  }

  try{
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncOnceEveryHour = function (minute, ipOrCallback, callback) {
  if(minute === undefined) {
    throw new Error('syncOnceEveryHour needs a minute');
  }

  let ip;
  if(typeof ipOrCallback === 'function') {
    callback = ipOrCallback
  } else {
    ip = ipOrCallback;
  }

  try{
    const interval = [0, minute];
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncOnceEveryDay = function ([hour, minute], ipOrCallback, callback) {
  if(hour === undefined) {
    throw new Error('syncOnceEveryDay needs an interval');
  }

  let ip;
  if(typeof ipOrCallback === 'function') {
    callback = ipOrCallback
  } else {
    ip = ipOrCallback;
  }

  try{
    const interval = [0, minute||0, hour];
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncOnceEveryWeek = function ([dayOfWeek, hour, minute], ipOrCallback, callback) {
  if(dayOfWeek === undefined) {
    throw new Error('syncOnceEveryWeek needs an interval');
  }

  let ip;
  if(typeof ipOrCallback === 'function') {
    callback = ipOrCallback
  } else {
    ip = ipOrCallback;
  }

  try{
    let interval = [0, minute||0, hour||0, "*", "*", dayOfWeek];
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncOnceEveryMonth = function ([dayOfMonth, hour, minute], ipOrCallback, callback) {
  if(dayOfMonth === undefined) {
    throw new Error('syncOnceEveryMonth needs an interval');
  }

  let ip;
  if(typeof ipOrCallback === 'function') {
    callback = ipOrCallback
  } else {
    ip = ipOrCallback;
  }

  try{
    let interval = [0, minute||0, hour||0, dayOfMonth];
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncByCronTime = function (cronTime, ipOrCallback, callback) {
  let ip;
  if(typeof ipOrCallback === 'function') {
    callback = ipOrCallback
  } else {
    ip = ipOrCallback;
  }

  if(typeof cronTime !== 'string') {
    throw new Error(`cronTime must be string not ${typeof cronTime}`);
  }

  return createCronJob(this, cronTime, ip, callback);
}

CloudflareDDNSSync.prototype.syncAtDate = function (date, ipOrCallback, callback) {
  let ip;
  if(typeof ipOrCallback === 'function') {
    callback = ipOrCallback
  } else {
    ip = ipOrCallback;
  }

  if(date.toString() === 'Invalid Date') {
    throw new Error('The date is invalid');
  }
  if(typeof date !== 'object') {
    throw new Error(`Date must not be ${typeof date}`);
  }
  if(Date.now() > date) {
    throw Error('The timetravel function is not working at the moment. The date must not be in the past')
  }

  return createCronJob(this, date, ip, callback);
}

CloudflareDDNSSync.prototype.syncByTimestring = function (timestring, ipOrCallback, callback) {
  let ip;
  if(typeof ipOrCallback === 'function') {
    callback = ipOrCallback
  } else {
    ip = ipOrCallback;
  }

  try{
    const cronTime = ctConverter.convertTimestringToCronTime(timestring);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.sync = async function (ip) {
  if(cfRecordIds.then !== undefined) {
    cfRecordIds = await cfRecordIds;
  }

  let ipToSync = ip;
  if(!ipToSync) {
    ipToSync = await this.getIp();
  }

  const results = [];
  for(const recordId of cfRecordIds) {
    const currentResult = updateIpOfRecord(recordId, ipToSync);
    results.push(currentResult);
  }

  return Promise.all(results);
}

module.exports = CloudflareDDNSSync;
