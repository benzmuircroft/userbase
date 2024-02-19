const userbase = async (options) => {
  return new Promise(async (resolve) => {
    
    const Corestore = require('corestore');
    const Autobase = require('autobase');
    const AutobaseManager = (await import('@lejeunerenard/autobase-manager')).AutobaseManager;
    const Hyperbee = require('hyperbee');
    const Hyperswarm = require('hyperswarm');
    const Hypercore = require('hypercore');
    const DHT = require('hyperdht');
    const b4a = require('b4a');
    const crypto = require('hypercore-crypto');
    const goodbye = (await import('graceful-goodbye')).default;
    const RAM = require('random-access-memory');
    const ProtomuxRPC = require('protomux-rpc');
    const fs = (await require('fs')).promises;

    if (!options) {
      throw new Error('options object is missing');
    }
    else if (!options.folderName || typeof options.folderName !== 'string') {
      throw new Error('options.folderName should be a string');
    }
    else if (options.testFolder && typeof options.testFolder !== 'string') {
      throw new Error('options.testFolder should be a string');
    }
    if (!options.encrypt || !options.decrypt) {
      throw new Error('both options.encrypt and options.decrypt custom methods are required');
    }
    if (!options.quit || typeof options.quit != 'function') {
      throw new Error('options.quit is expected to be a function that closes the app to stop multiple writers');
    }
    if (!options.knockout) {
      throw new Error('options.knockout is expected to be a function that closes the app to stop multiple writers');
    }

    let input, base, swarm, secret, ub, clients; // clients all have random publicKeys

    function broadcast(d) { // txupdates pushed to all users ...
      for (let p in clients) {
        clients[p].event('broadcast', b4a.from(JSON.stringify(d)));
      }
    }
    
    try {
      let core = new Hypercore('./db/db', { valueEncoding: 'utf8', createIfMissing: false });
      await core.ready();
      secret = options.decrypt((await core.get(core.length - 1)).toString('hex'));
      console.log('secret:', secret);
      options.keyPair = crypto.keyPair(b4a.from(secret));
      await core.close();
    } catch (e) {
      console.log(e);
    }

    async function restartBase(task, options, reffereeUserName, referralUserName, profile, resolve) {
      if (!options.keyPair) {
        try {
          await fs.rm(options.folderName, { recursive: true });
          console.log('removed userbase');
        } catch (e) {}
      }
      const store = new Corestore(options.keyPair ? options.folderName : RAM);
      await store.ready();
      if (task == 'wait' && options.loadingFunction) options.loadingFunction();
      if (options.keyPair) input = store.get({ keyPair: options.keyPair });
      let output = store.get({ name: 'output' });
      if (task == 'wait' && options.loadingFunction) options.loadingFunction();
      if (options.keyPair) await input.ready();
      if (task == 'wait' && options.loadingFunction) options.loadingFunction();
      await output.ready();
      base = new Autobase({
        inputs: (options.keyPair)? [input] : [],
        localInput: (options.keyPair) ? input : null,
        localOutput: output
      });
      base.start({
        unwrap: true,
        apply: async function(bee, batch) {
          const b = bee.batch({ update: false });
          for (const node of batch) {
            const op = JSON.parse(node.value.toString());
            if (op.type === 'del') await b.del(op.key); // not used
            else if (op.type === 'put') await b.put(op.key, op.value.toString());
          }
          await b.flush();
        },
        view: core => new Hyperbee(core.unwrap(), {
          extension: false
        })
      });
      if (task == 'wait' && options.loadingFunction) options.loadingFunction();
      await base.ready();
      const manager = new AutobaseManager(
        base,
        (key, coreType, channel) => true, // function to filter core keys
        store.get.bind(store), // get(key) function to get a hypercore given a key
        store.storage, // Storage for managing autobase keys
        { id: options.folderName } // Options
      );
      if (task == 'wait' && options.loadingFunction) options.loadingFunction();
      await manager.ready();
      swarm = new Hyperswarm();
      if (options.server) clients = {};
      swarm.on('connection', function(peer) {
        if (options.pngStore) options.pngStore.replicate(peer); // plug in pngDrive 
        const stream = store.replicate(peer);
        manager.attachStream(stream); // Attach manager
        const rpc = new ProtomuxRPC(peer);
        if (options.server) {
          rpc.remotePublicKey = peer.remotePublicKey.toString('hex');
          clients[rpc.remotePublicKey] = rpc;
          rpc.on('close', async function() {
            delete clients[rpc.remotePublicKey];
          });
        }
        else {
          rpc.respond('broadcast', async function(d) { // todo: async or not
            if (options.onBroadcast.handler) options.onBroadcast.handler(d);
          });
        }
      });
      if (task == 'wait' && options.loadingFunction) options.loadingFunction();
      await swarm.join(b4a.alloc(32).fill(options.folderName), { server: true, client: true });
      if (task == 'wait' && options.loadingFunction) options.loadingFunction();
      await swarm.flush();
      goodbye(() => swarm.destroy());
      if (task == 'register') {
        console.log('doing register');
        await register(reffereeUserName, referralUserName, profile, resolve);
      }
    }

    const get = async function(key) {
      await base.latest(base.inputs);
      await base.view.update({ wait: true });
      key = await base.view.get(key);
      if (!key) return key;
      key.value = key.value.toString();
      if (['[', '{'].includes(key.value[0])) return JSON.parse(key.value);
      return key.value;
    };

    const _put = async function(key, value) { 
      const op = b4a.from(JSON.stringify({ type: 'put', key, value: JSON.stringify(value) }));
      await base.append(op);
      await base.view.update({ wait: true });
      await base.latest(base.inputs);
    };

    const put = async function() {
      console.log('put is dissabled');
    };

    async function recover(username, secret) {
      return new Promise((resolve) => {
        ;(async function () {
          const keyPair = crypto.keyPair(b4a.from(secret));
          let hasdbdb = false;
          try { 
            await fs.stat('./db/db');
            hasdbdb = true;
          } catch (e) {}
          if (hasdbdb) {
            await fs.rm('./db/db', { recursive: true });
            await base.close();
            swarm.destroy();
            await restartBase('wait', options); // had to restart it without the local input
          }
          const profile = await get(username);
          if (!profile) {
            resolve('fail no profile');
          }
          else {
            console.log(profile);
            const verified = crypto.verify(b4a.from(username), b4a.from(profile.sig, 'hex'), keyPair.publicKey);
            if (!verified) {
              resolve('fail verifier');
            }
            else {
              const core = new Hypercore('./db/db', { valueEncoding: 'utf8' });
              await core.ready();
              await core.append(b4a.from(options.encrypt(secret)));
              await core.close();
              await base.close();
              swarm.destroy();
              ub.login = login;
              delete ub.register;
              resolve('success');
            }
          }
        })();
      });
    }

    

    const phone = {
      node: undefined,
      setup: async function(userbaseKeyPair) { // done on login
        this.node = new DHT(userbaseKeyPair);
        await this.node.ready();
      },
      call: async (method, remoteUserbasePublicKey, d) => {
        return new Promise((resolve) => {
          ;(async function(remoteUserbasePublicKey, d, resolve) {
            let req = this.node.connect(remoteUserbasePublicKey);
            req.on('open', function() {
              req.write(b4a.from(JSON.stringify([method, d])));
            });
            req.on('error', function (error) {
              console.log('Client errored:', error);
              req.end();
              resolve({ error });
            });
            req.on('data', function(r) {
              req.end();
              resolve(r);
            });
          })(remoteUserbasePublicKey, d, resolve);
        });
      }
    };

    async function login(password, username, onCall) {
      return new Promise((resolve) => {
        ;(async function (password, username, onCall, resolve) {
          const core = new Hypercore('./db/db', { valueEncoding: 'utf8' });
          await core.ready();
          const secret = options.decrypt((await core.get(core.length - 1)).toString('hex'));
          await core.close();
          const keyPair = crypto.keyPair(b4a.from(secret));
          const pin = secret.substring(0, 3) + secret.substring(secret.length - 3);
          if (password !== pin) {
            resolve([false]);
          }
          else {
            console.log(await options.knockout(keyPair.publicKey));
            const node = new DHT({ keyPair });
            const server = node.createServer();
            const calls = [];
            server.on('connection', function (soc) {
              calls[soc.remotePublicKey.toString('hex')] = soc;
              soc.on('data', async function (d) {
                let er;
                try { d = JSON.parse(d); }
                catch (e) { er = e; }
                if (!er) {
                  if (d.punch) options.quit();
                  else await onCall(soc, d); // has the userbasePublicKey of the user that is calling you
                }
              });
              soc.on('error', function (e) {
                console.trace(e);
              });
              soc.once('close', function() {
                delete calls[soc.remotePublicKey.toString('hex')];
              });
            });
            await server.listen();
            let cache = await ub.lookup(username);
            await phone.setup(crypto.keyPair(b4a.from(options.decrypt(cache.userbase)))); // you can call userbase individuals
            let throttle;
            if (options.server) {
              resolve([
                'success',
                { 
                  _id: username,
                  get: async function() { return await ub.lookup(username); },
                  put: async function(o) {
                    cache = o;
                    clearTimeout(throttle);
                    throttle = setTimeout(async function (username, o) { await ub.put(username, o); }, 100, username, o);
                  },
                  close: ub.close
                },
                broadcast,
                phone.call,
                keyPair,
                username != 'seed' ? undefined : {
                  put: async function(object, o) { // seed can put additional structure here without hurting users
                    o.type = 'ob';
                    return await ub.put('@' + object, o);
                  },
                  get: async function(object) { return await ub.lookup('@' + object); }
                }
              ]);
            }
            else {
              resolve([
                'success',
                { 
                  _id: username,
                  put: async function(o) {
                    cache = o;
                    clearTimeout(throttle);
                    throttle = setTimeout(async function (username, o) { await ub.put(username, o); }, 100, username, o);
                  },
                  get: async function() { return await ub.lookup(username); },
                  close: ub.close
                },
                phone.call,
                keyPair,
                username != 'seed' ? undefined : {
                  put: async function(object, o) { return await ub.put('@' + object, o); }, // seed can put additional structure here without hurting users
                  get: async function(object) { return await ub.lookup('@' + object); }
                }
              ]);
            }
          }
        })(password, username, onCall, resolve);
      });
    }
  
    async function register(reffereeUserName, referralUserName, profile, resolve) {
      if (!reffereeUserName || !referralUserName || !profile) throw new Error('malformed details');
      if (reffereeUserName != 'seed' && !await get('seed')) throw new Error('seed username needs to exist first');
      if (referralUserName != 'seed' && !await get(reffereeUserName)) {
        return new Promise((resolve) => resolve(['ether the reffereeUserName does not exist or the referralUserName exists']));
      }
      else {
        const already = await get(referralUserName);
        if (already && already !== referralpublicKey) {
          return new Promise((resolve) => resolve(['ether the reffereeUserName does not exist or the referralUserName exists']));
        }
        else {
          if (!already) {
            if (!options.keyPair) {
              return new Promise((resolve) => {
                ;(async function (reffereeUserName, referralUserName, profile, resolve) {
                  await base.close();
                  swarm.destroy();
                  if (!secret) {
                    secret = options.secret || crypto.randomBytes(16).toString('hex');
                    options.keyPair = crypto.keyPair(b4a.from(secret));
                    try { await fs.rm('./db/db', { recursive: true }); } catch (e) {}
                    const core = new Hypercore('./db/db', { valueEncoding: 'utf8' });
                    await core.ready();
                    await core.append(b4a.from(options.encrypt(secret)));
                    await core.close();
                  }
                  await restartBase('register', options, reffereeUserName, referralUserName, profile, resolve);
                })(reffereeUserName, referralUserName, profile, resolve);
              });
            }
            else {
              delete ub.register; // function only can be done once !
              profile = {
                ...profile,
                sig:        crypto.sign(b4a.from(profile._id), options.keyPair.secretKey).toString('hex'), // used in userbase.recover
                userbase:   options.encrypt(crypto.randomBytes(16).toString('hex')), // todo
                hyperdown:  options.hyperdown ? options.encrypt(crypto.randomBytes(16).toString('hex')) : undefined
              };
              await _put(referralUserName, profile);
              ub.put = _put;
              ub.login = login;
              const pin = secret.substring(0, 3) + secret.substring(secret.length - 3);
              resolve(['success', secret, pin]);
            }
          }
        }
      }
    }

    await restartBase('wait', options);

    if (!options.keyPair) {
      ub = { lookup: get, register, recover, put, close: base.close };
      resolve(ub);
    }
    else {
      ub = { lookup: get, put: _put, close: base.close, login, recover };
      resolve(ub);
    }
  });
};

module.exports = userbase;
