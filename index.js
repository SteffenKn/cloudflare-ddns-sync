'use strict';
const cloudflare = require('cloudflare');
const cron = require('node-cron');
require('colors');
const ctConverter = require('./lib/crontime-converter');
const ipUtil = require('./lib/ip-utils')

let cf = null;
let configEmail = null;
let configKey = null;
let configDomain = null;
let configRecords = [];

let cfRecords = [];

let cfZoneId = null;
let cfRecordIds = [];

let initialized = false;

const CloudflareDDNSSync = function(options) {
  const cdsWasUsedWrong = !options
                       || !options.auth
                       || !options.domain
                       || !options.records
                       || !options.auth.email
                       || !options.auth.key
                       || !(options.records.length > 0);

  if (cdsWasUsedWrong) {

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

  configEmail = options.auth.email;
  configKey = options.auth.key;
  configDomain = options.domain;
  configRecords = options.records;

  cf = cloudflare({
    email: configEmail,
    key: configKey
  });

  cfZoneId = getZoneId();
  cfRecordIds = getRecordIds();
}

async function initialSetup() {
  cfRecordIds = await cfRecordIds;

  const newRecords = [];

  for (const configRecord of configRecords) {
    const record = cfRecords.find((cfRecord) => {
      return cfRecord.name === configRecord;
    });

    if (record === undefined) {
      newRecords.push(addDnsRecord(configRecord));
    }
  }

  return Promise.all(newRecords)
                .then (() => {
                  cfRecordIds = getRecordIds();
                  initialized = true;
                });
}

function addDnsRecord(newRecordName) {
  const newDnsRecord = {
    name: newRecordName,
    type: 'A',
    content: '0.0.0.0'
  }

  return cf.dnsRecords.add(cfZoneId, newDnsRecord);
}

function getZoneId() {
  return cf.zones
          .browse()
          .then((response) => {
            const zones = response.result;

            for (const zone of zones) {
              const searchedZoneFound = zone.name === configDomain;
              if (searchedZoneFound) {
                return zone.id;
              }
            }

            return null;
          });
}

async function getRecordIds() {
  cfZoneId = await cfZoneId;
  cfRecords = await getRecords();

  const recordIds = [];

  for (const record of cfRecords) {
    const searchedRecordFound = configRecords.includes(record.name);
    if (searchedRecordFound) {
      recordIds.push(record.id);
    }

    const allSearchedRecordsFound = recordIds.length === configRecords.length
    if (allSearchedRecordsFound) {
      break;
    }
  }

  return recordIds;
}

function getRecords() {
  return cf.dnsRecords
          .browse(cfZoneId)
          .then ((response) => {
            const records = response.result;

            return records;
          });
}

async function getRecordIps() {
  const recordIps = [];

  for (const recordId of cfRecordIds) {
    const currentIp = cf.dnsRecords
    .read(cfZoneId, recordId)
    .then((response) => {
      return response.result.content;
    });

    recordIps.push(currentIp);
  }

  return Promise.all(recordIps);
}

function getRecord(recordId) {
  return cf.dnsRecords
          .read(cfZoneId, recordId)
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
  return cron.schedule(cronTime, async () => {
    if(ip === null){
      ip = await ipUtil.getIp();
    }

    const syncResult = ddnsSync.sync(ip);

    const callbackGiven = typeof callback === 'function';
    if (callbackGiven) {
      callback(syncResult);
    }
  });
}

CloudflareDDNSSync.prototype.getIp = ipUtil.getIp;

CloudflareDDNSSync.prototype.getRecordIps = getRecordIps;

CloudflareDDNSSync.prototype.sync = async function (ip) {
  if (!initialized) {
    await initialSetup();
  }

  const cfRecordsNotSet = cfRecordIds.then !== undefined;
  if (cfRecordsNotSet) {
    cfRecordIds = await cfRecordIds;
  }

  let ipToSync = ip ? ip : await this.getIp();

  const results = [];

  for (const recordId of cfRecordIds) {
    const currentResult = updateIpOfRecord(recordId, ipToSync);

    results.push(currentResult);
  }

  return Promise.all(results);
}

CloudflareDDNSSync.prototype.syncOnIpChange = async function (callback) {
  if (!initialized) {
    await initialSetup();
  }

  const cfRecordsNotSet = cfRecordIds.then !== undefined;
  if (cfRecordsNotSet) {
    cfRecordIds = await cfRecordIds;
  }

  ipUtil.onIpChange(this, (ip) => {
    const result = this.sync(ip);

    const callbackIsSet = typeof callback === 'function';
    if (callbackIsSet) {
      callback(result);
    }
  });
}

CloudflareDDNSSync.prototype.stopSyncOnIpChange = ipUtil.stopOnIpChange;

CloudflareDDNSSync.prototype.syncByInterval = function (interval, ipOrCallback, callback) {
  const intervalNotSet = interval === undefined;

  if (intervalNotSet) {
    throw new Error('syncByInterval needs an interval');
  }

  const ipIsSet = typeof ipOrCallback !== 'function'
                  && ipOrCallback !== undefined;

  const ip = ipIsSet ? ipOrCallback : null;

  callback = ipIsSet ? callback
                     : ipOrCallback;

  try {
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncOnceEveryHour = function (minute, ipOrCallback, callback) {
  const minuteNotSet = minute === undefined;
  if (minuteNotSet) {
    throw new Error('syncOnceEveryHour needs a minute');
  }

  const ipIsSet = typeof ipOrCallback !== 'function'
                  && ipOrCallback !== undefined;

  const ip = ipIsSet ? ipOrCallback : null;

  callback = ipIsSet ? callback
                     : ipOrCallback;

  try {
    const interval = [0, minute];
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncOnceEveryDay = function ([hour, minute], ipOrCallback, callback) {
  const hourNotSet = hour === undefined;
  if (hourNotSet) {
    throw new Error('syncOnceEveryDay needs an interval');
  }

  const ipIsSet = typeof ipOrCallback !== 'function'
                  && ipOrCallback !== undefined;

  const ip = ipIsSet ? ipOrCallback : null;

  callback = ipIsSet ? callback
                     : ipOrCallback;

  try {
    const interval = [0, minute||0, hour];
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncOnceEveryWeek = function ([dayOfWeek, hour, minute], ipOrCallback, callback) {
  const dayOfWeekNotSet = dayOfWeek === undefined;
  if (dayOfWeekNotSet) {
    throw new Error('syncOnceEveryWeek needs an interval');
  }

  const ipIsSet = typeof ipOrCallback !== 'function'
                  && ipOrCallback !== undefined;

  const ip = ipIsSet ? ipOrCallback : null;

  callback = ipIsSet ? callback
                     : ipOrCallback;


  try {
    const interval = [0, minute||0, hour||0, "*", "*", dayOfWeek];
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncOnceEveryMonth = function ([dayOfMonth, hour, minute], ipOrCallback, callback) {
  const dayOfMonthNotSet = dayOfMonth === undefined;
  if (dayOfMonthNotSet) {
    throw new Error('syncOnceEveryMonth needs an interval');
  }

  const ipIsSet = typeof ipOrCallback !== 'function'
                  && ipOrCallback !== undefined;

  const ip = ipIsSet ? ipOrCallback : null;

  callback = ipIsSet ? callback
                     : ipOrCallback;


  try {
    const interval = [0, minute||0, hour||0, dayOfMonth];
    const cronTime = ctConverter.convertIntervalToCronTime(interval);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

CloudflareDDNSSync.prototype.syncByCronTime = function (cronTime, ipOrCallback, callback) {
  const wrongTypeForCronTimeUsed = typeof cronTime !== 'string';
  if (wrongTypeForCronTimeUsed) {
    throw new Error(`cronTime must be string not ${typeof cronTime}`);
  }

  const ipIsSet = typeof ipOrCallback !== 'function'
                  && ipOrCallback !== undefined;

  const ip = ipIsSet ? ipOrCallback : null;

  callback = ipIsSet ? callback
                     : ipOrCallback;

  return createCronJob(this, cronTime, ip, callback);
}

CloudflareDDNSSync.prototype.syncAtDate = function (date, ipOrCallback, callback) {
  const invalidDateWasSet = date.toString() === 'Invalid Date';
  if (invalidDateWasSet) {
    throw new Error('The date is invalid');
  }

  const invalidDateType = typeof date !== 'object';
  if (invalidDateType) {
    throw new Error(`Date must not be ${typeof date}`);
  }

  const dateInPast = Date.now() > date;
  if (dateInPast) {
    throw Error('The timetravel function is not working at the moment. The date must not be in the past')
  }

  const ipIsSet = typeof ipOrCallback !== 'function'
                  && ipOrCallback !== undefined;

  const ip = ipIsSet ? ipOrCallback : null;

  callback = ipIsSet ? callback
                     : ipOrCallback;

  return createCronJob(this, date, ip, callback);
}

CloudflareDDNSSync.prototype.syncByTimestring = function (timestring, ipOrCallback, callback) {
  const ipIsSet = typeof ipOrCallback !== 'function'
                  && ipOrCallback !== undefined;

  const ip = ipIsSet ? ipOrCallback : null;

  callback = ipIsSet ? callback
                     : ipOrCallback;


  try {
    const cronTime = ctConverter.convertTimestringToCronTime(timestring);

    return createCronJob(this, cronTime, ip, callback);
  } catch (error) {
    throw error;
  }
}

module.exports = CloudflareDDNSSync;
