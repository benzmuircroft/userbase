const userbase = async (options) => {
  return new Promise(async (resolve) => {
    
    const Corestore = require('corestore');
    const Autobase = require('autobase');
    const AutobaseManager = (await import('@lejeunerenard/autobase-manager')).AutobaseManager;
    const Hyperbee = require('hyperbee');
    const Hyperswarm = require('hyperswarm');
    const Hypercore = require('hypercore');
    const b4a = require('b4a');
    const crypto = require('hypercore-crypto');
    const goodbye = (await import('graceful-goodbye')).default;
    const RAM = require('random-access-memory');
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

    let input, base, swarm, secret, ub;

    try {
      let core = new Hypercore('./db/db', { valueEncoding: 'utf8', createIfMissing: false });
      await core.ready();
      secret = options.aes.de((await core.get(core.length - 1)).toString('hex'));
      options.keyPair = crypto.keyPair(b4a.from(secret));
      await core.close();
    } catch (e) {
      // console.log(e);
    }


    async function restartBase(task, options, reffereeUserName, referralUserName, profile) {
      
      if (!options.keyPair) {
        try {
          await fs.rm(options.folderName, { recursive: true });
        } catch (e) {}
      }
      const store = new Corestore(options.keyPair ? options.folderName : RAM);
      await store.ready();
      if (task == 'wait') options.loadingFunction(options.loadingNumber ++);
      if (options.keyPair) input = store.get({ keyPair: options.keyPair });
      let output = store.get({ name: 'output' });
      if (task == 'wait') options.loadingFunction(options.loadingNumber ++);
      if (options.keyPair) await input.ready();
      if (task == 'wait') options.loadingFunction(options.loadingNumber ++);
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
      if (task == 'wait') options.loadingFunction(options.loadingNumber ++);
      await base.ready();
      const manager = new AutobaseManager(
        base,
        (key, coreType, channel) => true, // function to filter core keys
        store.get.bind(store), // get(key) function to get a hypercore given a key
        store.storage, // Storage for managing autobase keys
        { id: options.folderName } // Options
      );
      if (task == 'wait') options.loadingFunction(options.loadingNumber ++);
      await manager.ready();
      
      
      swarm = new Hyperswarm();
      const clients = {};
      swarm.on('connection', function(socket) {
        const stream = store.replicate(socket);
        manager.attachStream(stream); // Attach manager
      });
      if (task == 'wait') options.loadingFunction(options.loadingNumber ++);
      await swarm.join(b4a.alloc(32).fill(options.folderName), { server: true, client: true });
      if (task == 'wait') options.loadingFunction(options.loadingNumber ++);
      await swarm.flush();
      goodbye(() => swarm.destroy());
      
      
      if (task == 'register') {
        await register(reffereeUserName, referralUserName, profile);
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
      ub.success = null;
      ub.secret = null;
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
        ub.success = 'fail no profile';
        return;
      }
      else {
        const verified = crypto.verify(b4a.from(username), b4a.from(profile.sig, 'hex'), keyPair.publicKey);
        if (!verified) {
          ub.success = 'fail verifier';
          return;
        }
        else {
          const core = new Hypercore('./db/db', { valueEncoding: 'utf8' });
          await core.ready();
          await core.append(b4a.from(options.aes.en(secret)));
          await core.close();
          await base.close();
          swarm.destroy();
          ub.success = 'success';
          return;
        }
      }
    }

    async function login(pin, username) {
      ub.success = null;
      ub.secret = null;
      // read ./db/db to get secret
      // 
      // reload with your keyPair
    }
  
    async function register(reffereeUserName, referralUserName, profile) {
      ub.success = null;
      ub.secret = null;
      if (!reffereeUserName || !referralUserName || !profile) throw new Error('malformed details');
      if (reffereeUserName != 'root' && !await get('root')) throw new Error('root username needs to exist first');
      if (referralUserName != 'root' && !await get(reffereeUserName)) {
        ub.success = 'ether the reffereeUserName does not exist or the referralUserName exists';
        return;
      }
      else {
        const already = await get(referralUserName);
        if (already && already !== referralpublicKey) {
          ub.success = 'ether the reffereeUserName does not exist or the referralUserName exists';
          return;
        }
        else {
          if (!already) {
            if (!options.keyPair) {
              await base.close();
              swarm.destroy();
              if (!secret) {
                secret = crypto.randomBytes(16).toString('hex');
                options.keyPair = crypto.keyPair(b4a.from(secret));
                try { await fs.rm('./db/db', { recursive: true }); } catch (e) {}
                const core = new Hypercore('./db/db', { valueEncoding: 'utf8' });
                await core.ready();
                await core.append(b4a.from(options.aes.en(secret)));
                await core.close();
              }
              await restartBase('register', options, reffereeUserName, referralUserName, profile);
            }
            else {
              // return new Promise ((resolve) => { resolve([success, secret]); }); // ?
              register = null;
              profile.sig = crypto.sign(b4a.from(profile._id), options.keyPair.secretKey).toString('hex');
              await _put(referralUserName, profile);
              ub.put = _put;
              ub.login = login;
              ub.success = 'success';
              ub.secret = secret;
              return;
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
      ub = { lookup: get, put: set, close: base.close, login, recover };
      resolve(ub);
    }
  });
};

module.exports = userbase;
