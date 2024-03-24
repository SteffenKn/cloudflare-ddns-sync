# Changelog

## v3

### 3.0.2

- 📝 Add logo to README
- ⬆️ Update dependencies
- 🔥 Remove `what-is-my-ip-address` and use retry instead, because `what-is-my-ip-address` is not maintained for a long time

### v3.0.1

- ⬆️ Update dependencies

### v3.0.0

**This package will now be released as native ECMAScript module.**

- ✨ **Add possibility to use Cloudflare API Token**
- ♻️ Reduce request if many DNS Records exist for one Zone
- ⬆️ Update dependencies

## v2

### v2.0.6

- ⬆️ Update dependencies

### v2.0.5

- 🚨 Replace tslint with eslint
- ⬆️ Update dependencies

### v2.0.4

- 📝 Update links in README
- ⬆️ Update dependencies

### v2.0.3

- ✨ **Add function to get ipv6 address**
- 🐛 **Fix syncing two records with the same name**
- 🐛 **Fix removing records if two records have the same name**
- ✏️ Fix typo in error messages
- 🐛 Make cloudflareClient private
- 📝 Update links in README

### v2.0.2

- 🐛 **Fix Publishing**

### v2.0.1

- ⬆️ Update Dependencies

### v2.0.0

- ♻️ **Rewrite Cloudflare-DDNS-Sync in Typescript**

## v1

### v1.5.4

- 📝 Update README

### v1.5.3

- 🐛 **Fix Stopping Sync On IP Change**
- 🐛 **Fix Crontime Converter For Hour**
- 🐛 **Fix Syncing With Crontime Without Setting an IP**
- ⚡️ **Small Performance Improvements**
- 💄 Improve Code Quality
- 💄 Extract Business Rules

### v1.5.2

- 🐛 Fix Wrong Using of Const

### v1.5.1

- 🐛 **Fix Bug When 'public-ip' Throws An Error**
- 💄 Improve Code Quality

### v1.5.0

- ✨ **Add Create Not Existing Records Functionality**
- ✨ **Add Fallback getIp Function**

### v1.4.0

- ✨ **Add Stop SyncOnIpChange Function**

### v1.3.4

- 🐛 **Fix ipChange Interval**

### v1.3.3

- 📝 **Add Changelog**

### v1.3.2

- ✨ **Add getRecordIps Function**
- ♻️ **Refactor syncOnIpChange**
- ✅ **Add Tests for Sync Functionality**
- 📝 **Improve README**
- 📝 **Add NPM Badge**
- 🔥 Remove Unnecessary Code
- 🚸 Update Description
- 🎨 Order Dependencies
- 🎨 Lint files

### v1.3.1

- 📝 **Fix README**

### v1.3.0

- ✨ **Add syncAtDate Function**
- 📝 **Improve README**

### v1.2.1

- 🚑 **Fix README**

### v1.2.0

- ✨ **Add onIpChange Function**
- 📝 **Adjust README**
- 🚚 Move Utils to Lib
- 🚚 Move IP Functions to Lib
- 🚚 Move Dependencies to devDependencies
- 🔧 Update Eslint Config
- 🎨 Fix Eslit Error

### v1.1.0

- ⚡️ **Improve Performance of First Sync**
- ✨ **Add Schedule Functionality**
- 🚸 **Improve Success Message of Sync Function**
- 📝 **Fix Typos in README**
- 📝 **Add Schedule Functions to README**
- ✅ Add Unittests
- ✨ Add Eslint

### v1.0.3

- 📝 **Fix Typo in README**
- 📄 Add LICENSE

### v1.0.2

- 📝 **Add "Get Your Cloudflare Api Key"-Section to README**

### v1.0.1

- ✨ **Add sync Function -> changes the IP of the configured DNS records on Cloudflare**
- ✨ **Add getIp Function -> returns the external IP**
- 📝 **Add README**
