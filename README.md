# 🕳🥊 userbase

## Installation
```
npm i "github:benzmuircroft/userbase"
```
## Usage
```js
const userbase = await require('userbase')({
  uniqueKeyPair: keyPair,
  folderName: 'folderName',
  testFolder: 'user1' // only needed if testing multiple instances in the same script
});

// initiate root
// await userbase.register('root', 'root');

let user1 = {
  reffereeUserName: 'root',
  referralUserName: 'alice',
  referralpublicKey: alicePubKey // use your imagination
};

let success = await userbase.register(user1.reffereeUserName, user1.referralUserName, user1.referralpublicKey);
console.log(success); // bool (the reffereeUserName must first exist and the referralUserName must not exist);

let user2 = {
  reffereeUserName: 'alice',
  referralUserName: 'bob',
  referralpublicKey: bobPubKey // use your imagination
};

let success = await userbase.register(user1.reffereeUserName, user1.referralUserName, user1.referralpublicKey);
console.log(success); // bool (the reffereeUserName must first exist and the referralUserName must not exist);

console.log(await userbase.lookup(alice));
// should return a publicKey
```
