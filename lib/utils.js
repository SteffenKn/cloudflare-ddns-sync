function getSecond(second){
  if(second !== "*" && (second < 0 || second > 59)){
    throw new Error(`Second must be between 0 and 59 or * (not ${second})`);
  }

  return second;
}

function getMinute(minute){
  if(minute !== "*" && (minute < 0 || minute > 59)){
    throw new Error(`Minute must be between 0 and 59 or * (not ${minute})`);
  }

  return minute;
}

function getHour(hour){
  if(hour !== "*" && (hour < 0 || hour > 24)){
    throw new Error(`Hour must be between 0 and 24 (not ${hour})`);
  }
  if(hour === 24 && minute > 0){
    throw new Error('Minute must be 0 or * when hour is 24');
  }

  return hour;
}

function getDayOfMonth(dayOfMonth){
  if(dayOfMonth !== "*" && (dayOfMonth < 1 || dayOfMonth > 31)) {
    throw new Error(`Day of month must be between 1 and 31 (not ${dayOfMonth})`);
  }

  return dayOfMonth;
}

function getMonth(month){
  if(month !== "*" && (month < 0 || month > 12)){
    throw new Error(`Month must be between 1 and 12 (not ${month})`);
  }

  return month;
}

function getDayOfWeek(dayOfWeek){
  if(dayOfWeek !== "*" && (dayOfWeek < 0 || dayOfWeek > 7)){
    throw new Error(`Day of week must be between 0 and 7 (not ${dayOfWeek})`);
  }
  if(dayOfWeek === 7) {
    dayOfWeek = 0;
  }
  
  return dayOfWeek;
}

// interval = [second, minute, hour, dayOfMonth, month, dayOfWeek]
function convertIntervalToCronTime(interval) {
  if(interval.length === 0){
    throw new Error(`The interval can not be empty`);
  } else if (interval.length > 6) {
    throw new Error('The interval can not contain more than 6 ranges');
  }

  const timeArray = fillInterval(interval);

  try {
    timeArray[0] = getSecond(timeArray[0]);
    timeArray[1] = getMinute(timeArray[1]);
    timeArray[2] = getHour(timeArray[2]);
    timeArray[3] = getDayOfMonth(timeArray[3]);
    timeArray[4] = getMonth(timeArray[4]);
    timeArray[5] = getDayOfWeek(timeArray[5]);
  } catch(error){
    throw error;
  }

  const cronTime = `${timeArray[0]} ${timeArray[1]} ${timeArray[2]} ${timeArray[3]} ${timeArray[4]} ${timeArray[5]}`;
  return cronTime;
}

function fillInterval(interval) {
  let isNothingSet = true;

  for(let i = 0; i < 6; i++){
    if(interval[i] === undefined) {
      interval[i] = "*";
    } else if(interval[i] !== "*") {
      isNothingSet = false;
    }
  }

  if(isNothingSet){
    throw new Error('The interval must contain some value except "*"');
  }

  return interval;
}

function convertTimestringToCronTime(time){
  let [h, m] = [0, 0];

  try {
    [, h, m]= /(\d{2}):(\d{2})/.exec(time);
  } catch (error){
    throw new Error('The interval must have this format: "24:00"');
  }

  h = parseInt(h);
  m = parseInt(m);
  
  const isTimeValid = checkTime(h, m);
  if(!isTimeValid) {
    throw new Error('The timestring must be a time between "0:00" and "24:00"');
  }

  const cronTime = `0 ${m} ${h} * * *`;
  return cronTime;
}

function checkTime(hour, min){
  if(hour < 0 || hour > 24 || (hour == 24 && min > 0)) {
    return false;
  }

  if(min < 0 || min > 59){
    return false;
  }

  return true;
}

module.exports = {
  convertTimestringToCronTime,
  convertIntervalToCronTime
};
