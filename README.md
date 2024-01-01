# 🕳🥊 Userbase 😀
A user invite-only registration system

## Installation
```
npm i "github:benzmuircroft/userbase"
```
## Usage
```js
;(async function() {

  const Keychain = (await import('keypear')).default; // https://github.com/holepunchto/keypear
  const b4a = require('b4a');
  
  const userbase = await require('userbase')({
    folderName: 'folderName',
    testFolder: 'user1' // only needed if testing multiple instances in the same script
  });

  // initiate root
  await userbase.register('root', 'root');

  const kpAlice = new Keychain({
    scalar: b4a.from('684e14316d8f379829ee5d1b883dffd2cf123f2987b8658353ae740ed8758565', 'hex'),
    publicKey: b4a.from('09f9cb2e6097bab4936696c7fb2e80c52ecc7e7a0dfe67274d93198e785c1558', 'hex')
  }).get();

  let user1 = {
    reffereeUserName: 'root',
    referralUserName: 'alice',
    referralpublicKey: kpAlice
  };

  let success = await userbase.register(user1.reffereeUserName, user1.referralUserName, user1.referralpublicKey);
  console.log(success); // bool (the reffereeUserName must first exist and the referralUserName must not exist);
  
  const kpBob = new Keychain({
    scalar: b4a.from('b0cf93c3f3589ea5e7a09b752e7b6492e6e331661da8fe88854d692aec59114f', 'hex'),
    publicKey: b4a.from('4cce6d17f4000b19b9f752fb7c185a56cff16d86f0cda8673e5ab6baed9e7171', 'hex')
  }).get();
  
  let user2 = {
    reffereeUserName: 'alice',
    referralUserName: 'bob',
    referralpublicKey: kpBob
  };
  
  let success = await userbase.register(user1.reffereeUserName, user1.referralUserName, user1.referralpublicKey);
  console.log(success); // bool (the reffereeUserName must first exist and the referralUserName must not exist);
  
  console.log(await userbase.lookup('alice')); // should return a publicKey
  
  // handle errors
  
  let success = await userbase.register('noneExitsUser', user1.referralUserName, user1.referralpublicKey); // false
  
  let success = await userbase.register(user1.reffereeUserName, 'bob', user1.referralpublicKey); // username bob already exists
  
  console.log(await userbase.lookup('noneExitsUser')); // null
  
})();
```
