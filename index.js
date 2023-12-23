const userbase = async (options) => {
  return new Promise(async (resolve) => {
    
    const Corestore = require('corestore');
    const Autobase = require('autobase');
    const AutobaseManager = (await import('@lejeunerenard/autobase-manager')).AutobaseManager;
    const Hyperbee = require('hyperbee');
    const Hyperswarm = require('hyperswarm');

    if (!options) {
      throw new Error('options object is missing');
    }
    else if (!options.uniqueKeyPair) {
      throw new Error('options.uniqueKeyPair should be a KeyChain or keyPair. see: https://github.com/holepunchto/keypear');
    }
    else if (!options.isServer && !options.serverPublicKey) {
      throw new Error('options.serverPublicKey should be a TypedArray');
    }
    else if (!options.folderName || typeof options.folderName !== 'string') {
      throw new Error('options.folderName should be a string');
    }
    else if (options.testFolder && typeof options.testFolder !== 'string') {
      throw new Error('options.testFolder should be a string');
    }

    if (!options.uniqueKeyPair.publicKey) {
      if (typeof options.uniqueKeyPair.get == 'function') {
        keyPair = options.uniqueKeyPair.get();
      }
      else {
        throw new Error('options.uniqueKeyPair should be a KeyChain or keyPair. see: https://github.com/holepunchto/keypear');
      }
    }
    else {
      keyPair = new Keychain(options.uniqueKeyPair);
      keyPair = keyPair.get();
    }

    let folder = `./${options.folderName}`;
    if (options.testFolder) {
      folder += `/${options.testFolder}`;
    }
    
    const store = new Corestore(folder);
    await store.ready();
    let input = store.get({ name: 'input' });
    let output = store.get({ name: 'output' });
    await input.ready();
    await output.ready();
    base = new Autobase({
      inputs: [input],
      localInput: input,
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
    await base.ready();
    const manager = new AutobaseManager(
      base,
      (key, coreType, channel) => true, // function to filter core keys
      store.get.bind(store), // get(key) function to get a hypercore given a key
      store.storage, // Storage for managing autobase keys
      { id: options.folderName } // Options
    );
    await manager.ready();

    swarm = new Hyperswarm();
    const clients = {};
    swarm.on('connection', function(socket) {
      const stream = store.replicate(socket);
      manager.attachStream(stream); // Attach manager
    });

    const get = async function(key) {
      await base.latest(base.inputs);
      await base.view.update({ wait: true });
      key = await base.view.get(key);
      if (!key) return key;
      key.value = key.value.toString();
      if (['[', '{'].includes(key.value[0])) return JSON.parse(key.value);
      return key.value;
    };
    const put = async function(key, value) {
      const op = b4a.from(JSON.stringify({ type: 'put', key, value: JSON.stringify(value) }));
      await base.append(op);
      await base.view.update({ wait: true });
      await base.latest(base.inputs);
    };

    async function register(reffereeUserName, referralUserName, referralpublicKey) {
      if (!reffereeUserName || !referralUserName || !referralpublicKey) throw new Error('malformed details');
      if (!await get(reffereeUserName)) {
        return 'refferee username does not exist';
      }
      else {
        if (await get(referralUserName)) {
          return 'username exists';
        }
        else {
          await put(referralUserName, referralpublicKey);
        }
      }
    }

    if (!input.length) {
      resolve({ lookup: get, register });
    }
    else {
      resolve({ lookup: get });
    }
  };
};

module.exports = userbase;
