const chai = require('chai'); 
const expect = chai.expect;

const ctConverter = require('../lib/crontime-converter');

describe('Convert Interval to CronTime', () => {
  describe ('ByInterval', () => {
    it('[0, 1, 2] should return "0 1 2 * * *"', () => {
      const result = ctConverter.convertIntervalToCronTime([0, 1, 2]);
      expect(result).to.equal('0 1 2 * * *');
    });


    it('[] should throw an error', () => {
      const convertIntervalFunction = function () {
        ctConverter.convertIntervalToCronTime([])
      };
      expect(convertIntervalFunction).to.throw('The interval can not be empty');
    });


    it('[0, 1, 2, 3, 4, 5, 6] should throw an error', () => {
      const convertIntervalFunction = function () {
        ctConverter.convertIntervalToCronTime([0, 1, 2, 3, 4, 5, 6]);
      };
      expect(convertIntervalFunction).to.throw('The interval can not contain more than 6 ranges');
    });

    it('["*", "*", "*", "*", "*", "*"] should throw an error', () => {
      const convertIntervalFunction = function () {
        ctConverter.convertIntervalToCronTime(["*", "*", "*", "*", "*", "*"]);
      };
      expect(convertIntervalFunction).to.throw('The interval must contain some value except "*"');
    });
  })

  describe ('OnceEveryWeek', () => {
    it('[0, 0, 7, "*", "*", 3] should return "0 0 7 * * 3"', () => {
      const result = ctConverter.convertIntervalToCronTime([0, 0, 7, "*", "*", 3]);
      expect(result).to.equal('0 0 7 * * 3');
    });

    it('[0, 0, 7, "*", "*", 7] should return "0 0 7 * * 0"', () => {
      const result = ctConverter.convertIntervalToCronTime([0, 0, 7, "*", "*", 7]);
      expect(result).to.equal('0 0 7 * * 0');
    });

    it('[0, 0, 7, "*", "*", 8] should throw an error', () => {
      const convertIntervalFunction = function () {
        ctConverter.convertIntervalToCronTime([0, 0, 7, "*", "*", 8]);
      };
      expect(convertIntervalFunction).to.throw('Day of week must be between 0 and 7 (not 8)');
    });
  });

  describe ('OnceEveryMonth', () => {
    it('[0, 0, 3, 5] should return "0 0 3 5 * *"', () => {
      const result = ctConverter.convertIntervalToCronTime([0, 0, 3, 5]);
      expect(result).to.equal('0 0 3 5 * *');
    });
  });
});

describe('Convert Timestring to CronTime', () => {
  it('"13:12" should return "0 12 13 * * *"', () => {
    const result = ctConverter.convertTimestringToCronTime("13:12");
    expect(result).to.equal('0 12 13 * * *');
  });

  it('"23:59" should return "0 59 23 * * *"', () => {
    const result = ctConverter.convertTimestringToCronTime("23:59");
    expect(result).to.equal('0 59 23 * * *');
  });

  it('"24:00" should return "0 0 24 * * *"', () => {
    const result = ctConverter.convertTimestringToCronTime("24:00");
    expect(result).to.equal('0 0 24 * * *');
  });

  it('"24:01" should throw an error', () => {
    const convertTimestampFunction = function () {
      ctConverter.convertTimestringToCronTime("24:01");
    };
    expect(convertTimestampFunction).to.throw('The timestring must be a time between "0:00" and "24:00"');
  });

  it('"12:60" should throw an error', () => {
    const convertTimestampFunction = function () {
      ctConverter.convertTimestringToCronTime("12:60");
    };
    expect(convertTimestampFunction).to.throw('The timestring must be a time between "0:00" and "24:00"');
  });  

  it('"-1:00" should throw an error', () => {
    const convertTimestampFunction = function () {
      ctConverter.convertTimestringToCronTime("-1:00");
    };
    expect(convertTimestampFunction).to.throw('The interval must have this format: "24:00"');
  });  
});
