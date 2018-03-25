const wimIp = require('what-is-my-ip-address');

function getIp() {
  return wimIp.v4();
}

function onIpChange(callback) {
  let lastIp;

  setInterval(async () => {
    const currentIp = await getIp();
    
    if(currentIp !== lastIp) {
      lastIp = currentIp;
      
      callback(currentIp);
    }
  }, 1000);
}

module.exports = {
  getIp,
  onIpChange
}
