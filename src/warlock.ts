import util from 'util';
import Scripty from 'node-redis-scripty';
import UUID from 'uuid';
import { WarlockError } from './WarlockError';

type Callback<T = any, E = Error> = (err?: E | null, result?: T) => void;
type UnlockFunction = (cb: Callback) => void;
type LockResult = false | UnlockFunction;

export = function (redis) {
  const warlock: {
    makeKey: (key: string) => string;
    lock: (key: string, ttl: number, cb?: Callback<LockResult>) => void;
    lockPromise: (key: string, ttl: number) => Promise<LockResult>;
    unlock: (key: string, id: string, cb?: Callback) => void;
    unlockPromise: (key: string, id: string) => Promise<any>;
    optimistic: (key: string, ttl: number, maxAttempts: number, wait: number, cb: Callback<UnlockFunction>) => void;
    optimisticPromise: (key: string, ttl: number, maxAttempts: number, wait: number) => Promise<UnlockFunction>;
  } = {} as any;

  const scripty = new Scripty(redis);

  warlock.makeKey = function (key: string) {
    return key + ':lock';
  };

  /**
   * Set a lock key
   * @param {string}   key    Name for the lock key. String please.
   * @param {integer}  ttl    Time in milliseconds for the lock to live.
   * @param {Function} cb
   */
  warlock.lock = function (key: string, ttl: number, cb?) {
    cb = cb || function () { };

    if (typeof key !== 'string') {
      return cb(new Error('lock key must be string'));
    }

    let id;
    UUID.v1(null, (id = new Buffer(16)));
    id = id.toString('base64');
    redis.set(
      warlock.makeKey(key), id,
      'PX', ttl, 'NX',
      function (err: Error | null, lockSet: boolean) {
        if (err) return cb(err);

        let unlock: LockResult = warlock.unlock.bind(warlock, key, id);
        if (!lockSet) unlock = false;

        return cb(err, unlock);
      }
    );

    return key;
  };

  warlock.lockPromise = util.promisify(warlock.lock);

  warlock.unlock = function (key: string, id, cb?) {
    cb = cb || function () { };

    if (typeof key !== 'string') {
      return cb(new Error('lock key must be string'));
    }

    scripty.loadScriptFile(
      'parityDel',
      __dirname + '/lua/parityDel.lua',
      function (err, parityDel) {
        if (err) return cb(err);

        return parityDel.run(1, warlock.makeKey(key), id, cb);
      }
    );
  };

  warlock.unlockPromise = util.promisify(warlock.unlock);

  /**
   * Set a lock optimistically (retries until reaching maxAttempts).
   */
  warlock.optimistic = function (key: string, ttl: number, maxAttempts: number, wait: number, cb) {
    let attempts = 0;

    const tryLock = () => {
      attempts += 1;
      warlock.lock(key, ttl, (err, unlock) => {
        if (err) return cb(err);

        if (typeof unlock !== 'function') {
          if (attempts >= maxAttempts) {
            const e = new WarlockError('unable to obtain lock', {
              maxAttempts,
              key,
              ttl,
              wait,
            });
            return cb(e);
          }
          return setTimeout(tryLock, wait);
        }

        return cb(err, unlock);
      });
    };

    tryLock();
  };

  warlock.optimisticPromise = util.promisify(warlock.optimistic);  

  return warlock;
};
