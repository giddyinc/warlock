
'use strict';

const util = require("util");
const should = require('should');
const redis = require('./setup/redisConnection');
const warlock = require('../lib/warlock')(redis);

require('./setup/redisFlush');

describe('locking - callback api', function () {
  it('sets lock', function (done) {
    warlock.lock('testLock', 1000, function (err, unlock) {
      should.not.exist(err);
      (typeof unlock).should.equal('function');

      done();
    });
  });

  it('does not set lock if it already exists', function (done) {
    warlock.lock('testLock', 1000, function (err, unlock) {
      should.not.exist(err);
      unlock.should.equal(false);

      done();
    });
  });

  it('does not alter expiry of lock if it already exists', function (done) {
    redis.pttl(warlock.makeKey('testLock'), function (err, ttl) {
      warlock.lock('testLock', 1000, function (err, unlock) {
        should.not.exist(err);
        unlock.should.equal(false);

        redis.pttl(warlock.makeKey('testLock'), function (err, ttl2) {
          (ttl2 <= ttl).should.equal(true);

          done();
        });
      });
    });
  });

  it('unlocks', function (done) {
    warlock.lock('unlock', 1000, function (err, unlock) {
      should.not.exist(err);
      unlock(done);
    });
  });
});

describe.only('locking - promise api', function () {
  it('sets lock', async () => {
    const unlock = await warlock.lockPromise('testLock', 1000);
    (typeof unlock).should.equal('function');
  });

  it('does not set lock if it already exists', async () => {
    const unlock = await warlock.lockPromise('testLock', 1000);
    unlock.should.equal(false);
  });

  it('does not alter expiry of lock if it already exists', async () => {
    const pttl = util.promisify(redis.pttl).bind(redis);
    const key = warlock.makeKey('testLock');
    const ttl = await pttl(key);
    const unlock = await warlock.lockPromise('testLock', 1000);
    unlock.should.equal(false);
    const ttl2 = await pttl(key);
    (ttl2 <= ttl).should.equal(true);
  });

  it('unlocks', async () => {
    const unlock = await warlock.lockPromise('unlock', 1000);
    await util.promisify(unlock)();
  });

});
