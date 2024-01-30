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

    if (!options) {
      throw new Error('options object is missing');
    }
    else if (!options.folderName || typeof options.folderName !== 'string') {
      throw new Error('options.folderName should be a string');
    }
    else if (options.testFolder && typeof options.testFolder !== 'string') {
      throw new Error('options.testFolder should be a string');
    }

    let folder = `./${options.folderName}`;
    if (options.testFolder) {
      folder += `/${options.testFolder}`;
    }

    let input, secret;

    async function restartbase(task, options, reffereeUserName, referralUserName, profile) {
      const store = new Corestore(folder);
      await store.ready();
      if (options.loadingFunction && !options.keyPair) options.loadingFunction(options.loadingNumber ++);
      if (options.keyPair) input = store.get({ name: 'input' });
      let output = store.get({ keyPair: options.keyPair });
      if (options.loadingFunction && !options.keyPair) options.loadingFunction(options.loadingNumber ++);
      if (options.keyPair) await input.ready();
      if (options.loadingFunction && !options.keyPair) options.loadingFunction(options.loadingNumber ++);
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
      if (options.loadingFunction && !options.keyPair) options.loadingFunction(options.loadingNumber ++);
      await base.ready();
      const manager = new AutobaseManager(
        base,
        (key, coreType, channel) => true, // function to filter core keys
        store.get.bind(store), // get(key) function to get a hypercore given a key
        store.storage, // Storage for managing autobase keys
        { id: options.folderName } // Options
      );
      if (options.loadingFunction && !options.keyPair) options.loadingFunction(options.loadingNumber ++);
      await manager.ready();
      
      if (!options.keyPair) {
        swarm = new Hyperswarm();
        const clients = {};
        swarm.on('connection', function(socket) {
          const stream = store.replicate(socket);
          manager.attachStream(stream); // Attach manager
        });
        if (options.loadingFunction) options.loadingFunction(options.loadingNumber ++);
        await swarm.join(b4a.alloc(32).fill(options.folderName), { server: true, client: true });
        if (options.loadingFunction) options.loadingFunction(options.loadingNumber ++);
        await swarm.flush();
        goodbye(() => swarm.destroy());
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
      const set = async function(key, value) {
        const op = b4a.from(JSON.stringify({ type: 'put', key, value: JSON.stringify(value) }));
        await base.append(op);
        await base.view.update({ wait: true });
        await base.latest(base.inputs);
      };

      const put = async function() {
        console.log('put is dissabled');
      };
  
      async function register(reffereeUserName, referralUserName, profile) {
        if (!reffereeUserName || !referralUserName || !profile) throw new Error('malformed details');
        if (reffereeUserName != 'root' && !await get('root')) throw new Error('root username needs to exist first');
        if (referralUserName != 'root' && !await get(reffereeUserName)) {
          return 'ether the reffereeUserName does not exist or the referralUserName exists';
        }
        else {
          const already = await get(referralUserName);
          if (already && already !== referralpublicKey) {
            return 'ether the reffereeUserName does not exist or the referralUserName exists';
          }
          else {
            register = null;
            if (!already) {
              if (!options.keyPair) {
                await base.close();
                secret = crypto.randomBytes(16).toString('hex');
                options.keyPair = crypto.keyPair(b4a.from(secret));
                const core = new Hypercore('./db/db', { valueEncoding: 'utf8' });
                await core.ready();
                await core.append(b4a.from(options.aes.en(secret)));
                await core.close();
                await restartbase(task, options, reffereeUserName, referralUserName, profile);
              }
              else {
                await set(referralUserName, profile);
                ub.put = set;
                return { success: 'success', secret };
              }
            }
          }
        }
      }
      if (task == 'register') await register(reffereeUserName, referralUserName, profile);
    }

    async function recover(secret, username) {
      // secret to keyPair
      // read and compair the base
      // reload with your keyPair
    }
    
    await restartbase('wait', options);

    let ub;

    if (!options.keyPair) {
      ub = { lookup: get, register, recover, put, close: base.close };
      resolve(ub);
    }
    else {
      ub = { lookup: get, put: set, close: base.close };
      resolve(ub);
    }
  });
};

module.exports = userbase;
