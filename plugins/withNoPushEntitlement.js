const { withEntitlementsPlist } = require('expo/config-plugins');

// DriveReport does not use push notifications. Also removes a stale capability
// left by earlier prebuilds, so a free Personal Team can sign the app.
module.exports = config => withEntitlementsPlist(config, config => {
  delete config.modResults['aps-environment'];
  return config;
});
