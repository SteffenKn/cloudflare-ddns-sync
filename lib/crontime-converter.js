function getSecond(second){
  const secondFormatIsInvalid = second !== "*"
                            && (second < 0
                             || second > 59)

  if (secondFormatIsInvalid){
    throw new Error(`Second must be between 0 and 59 or * (not ${second})`);
  }

  return second;
}

function getMinute(minute){
  const minuteFormatIsInvalid = minute !== "*"
                             && (minute < 0 
                              || minute > 59)

  if (minuteFormatIsInvalid){
    throw new Error(`Minute must be between 0 and 59 or * (not ${minute})`);
  }

  return minute;
}

function getHour(hour, minute){
  const hourFormatIsInvalid = hour !== "*"
                           && (hour < 0
                            || hour > 24);

  if (hourFormatIsInvalid){
    throw new Error(`Hour must be between 0 and 24 (not ${hour})`);
  }

  const minuteIsTooBig = hour === 24
                      && minute > 0;

  if (minuteIsTooBig){
    throw new Error('Minute must be 0 when hour is 24');
  }

  return hour;
}

function getDayOfMonth(dayOfMonth){
  const dayOfMonthIsInvalid = dayOfMonth !== "*"
                           && (dayOfMonth < 1
                            || dayOfMonth > 31);

  if (dayOfMonthIsInvalid) {
    throw new Error(`Day of month must be between 1 and 31 (not ${dayOfMonth})`);
  }

  return dayOfMonth;
}

function getMonth(month){
  const monthIsInvalid = month !== "*"
                      && (month < 0
                       || month > 12);

  if (monthIsInvalid){
    throw new Error(`Month must be between 1 and 12 (not ${month})`);
  }

  return month;
}

function getDayOfWeek(dayOfWeek){
  const dayOfWeekIsInvalid = dayOfWeek !== "*"
                 && (dayOfWeek < 0
                  || dayOfWeek > 7);

  if (dayOfWeekIsInvalid){
    throw new Error(`Day of week must be between 0 and 7 (not ${dayOfWeek})`);
  }

  // This is used, because the 7. day of the week is actually the 0. for cron
  const dayOfWeekIsSeven = dayOfWeek === 7;
  if (dayOfWeekIsSeven) {
    dayOfWeek = 0;
  }
  
  return dayOfWeek;
}

// interval = [second, minute, hour, dayOfMonth, month, dayOfWeek]
function convertIntervalToCronTime(interval) {
  const intervalIsEmpty = interval.length === 0;
  const intervalIsTooBig = interval.length > 6;

  if (intervalIsEmpty){
    throw new Error(`The interval can not be empty`);
  } else if (intervalIsTooBig) {
    throw new Error('The interval can not contain more than 6 ranges');
  }

  const timeArray = fillInterval(interval);

  try {
    timeArray[0] = getSecond(timeArray[0]);
    timeArray[1] = getMinute(timeArray[1]);
    timeArray[2] = getHour(timeArray[2], timeArray[1]);
    timeArray[3] = getDayOfMonth(timeArray[3]);
    timeArray[4] = getMonth(timeArray[4]);
    timeArray[5] = getDayOfWeek(timeArray[5]);
  } catch (error){
    throw error;
  }

  const cronTime = `${timeArray[0]} ${timeArray[1]} ${timeArray[2]} ${timeArray[3]} ${timeArray[4]} ${timeArray[5]}`;
  return cronTime;
}

function fillInterval(interval) {
  let noSpecificValueSet = true;

  for (let i = 0; i < 6; i++){
    const intervalEntryIsNotSet = interval[i] === undefined;
    const specificValueSet = interval[i] !== "*";

    if (intervalEntryIsNotSet) {
      interval[i] = "*";
    } else if (specificValueSet) {
      noSpecificValueSet = false;
    }
  }

  if(noSpecificValueSet){
    throw new Error('The interval must contain some value except "*"');
  }

  return interval;
}

function convertTimestringToCronTime(time){
  let [hour, minute] = [0, 0];

  try {
    [, hour, minute]= /(\d{2}):(\d{2})/.exec(time);
  } catch (error){
    throw new Error('The interval must have this format: "24:00"');
  }

  hour = parseInt(hour);
  minute = parseInt(minute);
  
  const timeIsNotValid = !checkTime(hour, minute);
  if (timeIsNotValid) {
    throw new Error('The timestring must be a time between "0:00" and "24:00"');
  }

  const cronTime = `0 ${minute} ${hour} * * *`;
  return cronTime;
}

function checkTime(hour, minute){
  const hourIsValid = hour >= 0
                   && (hour < 24
                    || (hour === 24
                     && minute === 0));

  const minuteIsValid = minute >= 0
                     && minute < 60;

  const timeIsValid = hourIsValid && minuteIsValid;
  return timeIsValid;
}

module.exports = {
  convertTimestringToCronTime,
  convertIntervalToCronTime
};
