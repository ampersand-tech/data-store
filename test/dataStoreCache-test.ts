/**
* Copyright 2018-present Ampersand Technologies, Inc.
*/

import * as DataStore from '../lib/dataStore';
import { DataStoreCache } from '../lib/dataStoreCache';

import { ResolvablePromise } from 'amper-promise-utils/dist/index';
import { expect } from 'chai';
import { describe, it } from 'mocha';

interface CacheParams {
  foo: string;
  bar: string;
}

interface FetchCall {
  key: string;
  params: CacheParams;
  promise: ResolvablePromise<number>;
}

describe('DataStoreCache', function() {
  DataStore.init({});

  let fetchCalls: FetchCall[] = [];

  const gCache = new DataStoreCache<number, CacheParams>({
    name: 'CacheTest',
    fetchData: async (key, params) => {
      const promise = new ResolvablePromise<number>();
      fetchCalls.push({ key, params, promise });
      return await promise.promise;
    },
    paramsToCachePath: (key, params) => {
      return [key, params.foo, params.bar];
    },
  });

  beforeEach(() => {
    fetchCalls = [];
    gCache.clear();
  });

  it('should fetch if not in cache', async() => {
    const res1 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res1.data).to.equal(undefined);
    expect(res1.err).to.equal(undefined);

    expect(fetchCalls.length).to.equal(1);
    expect(fetchCalls[0].key).to.equal('cmd');
    expect(fetchCalls[0].params).to.deep.equal({ foo: 'a', bar: 'b' });
    fetchCalls[0].promise.resolve(42);

    const finalRes = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(finalRes.data).to.equal(42);
    expect(finalRes.err).to.equal(undefined);
    expect(fetchCalls.length).to.equal(1);
  });

  it('should handle errors', async() => {
    const res1 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res1.data).to.equal(undefined);
    expect(res1.err).to.equal(undefined);

    expect(fetchCalls.length).to.equal(1);
    expect(fetchCalls[0].key).to.equal('cmd');
    expect(fetchCalls[0].params).to.deep.equal({ foo: 'a', bar: 'b' });
    fetchCalls[0].promise.reject(new Error('whoops'));

    const finalRes = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(finalRes.data).to.equal(undefined);
    expect(finalRes.err).to.equal('whoops');
    expect(fetchCalls.length).to.equal(1);
  });

  it('should not refetch if already in flight', async() => {
    const res1 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res1.data).to.equal(undefined);
    expect(res1.err).to.equal(undefined);

    const res2 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res2.data).to.equal(undefined);
    expect(res2.err).to.equal(undefined);

    expect(fetchCalls.length).to.equal(1);
    expect(fetchCalls[0].key).to.equal('cmd');
    expect(fetchCalls[0].params).to.deep.equal({ foo: 'a', bar: 'b' });
    fetchCalls[0].promise.resolve(42);

    const finalRes = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(finalRes.data).to.equal(42);
    expect(finalRes.err).to.equal(undefined);
    expect(fetchCalls.length).to.equal(1);
  });

  it('should refetch after invalidate', async() => {
    const res1 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res1.data).to.equal(undefined);
    expect(res1.err).to.equal(undefined);

    expect(fetchCalls.length).to.equal(1);
    expect(fetchCalls[0].key).to.equal('cmd');
    expect(fetchCalls[0].params).to.deep.equal({ foo: 'a', bar: 'b' });
    fetchCalls[0].promise.resolve(42);

    const res2 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res2.data).to.equal(42);
    expect(res2.err).to.equal(undefined);
    expect(fetchCalls.length).to.equal(1);

    gCache.invalidate('cmd', { foo: 'a', bar: 'b' });

    const res3 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res3.data).to.equal(undefined);
    expect(res3.err).to.equal(undefined);

    expect(fetchCalls.length).to.equal(2);
    expect(fetchCalls[1].key).to.equal('cmd');
    expect(fetchCalls[1].params).to.deep.equal({ foo: 'a', bar: 'b' });
    fetchCalls[1].promise.resolve(47);

    const finalRes = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(finalRes.data).to.equal(47);
    expect(finalRes.err).to.equal(undefined);
    expect(fetchCalls.length).to.equal(2);
  });

  it('should refetch after invalidate with noClear', async() => {
    const res1 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res1.data).to.equal(undefined);
    expect(res1.err).to.equal(undefined);

    expect(fetchCalls.length).to.equal(1);
    expect(fetchCalls[0].key).to.equal('cmd');
    expect(fetchCalls[0].params).to.deep.equal({ foo: 'a', bar: 'b' });
    fetchCalls[0].promise.resolve(42);

    const res2 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res2.data).to.equal(42);
    expect(res2.err).to.equal(undefined);
    expect(fetchCalls.length).to.equal(1);

    gCache.invalidate('cmd', { foo: 'a', bar: 'b' }, true);

    const res3 = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(res3.data).to.equal(42);
    expect(res3.err).to.equal(undefined);

    expect(fetchCalls.length).to.equal(2);
    expect(fetchCalls[1].key).to.equal('cmd');
    expect(fetchCalls[1].params).to.deep.equal({ foo: 'a', bar: 'b' });
    fetchCalls[1].promise.resolve(47);

    const finalRes = gCache.getDataWithError(null, 'cmd', { foo: 'a', bar: 'b' });
    expect(finalRes.data).to.equal(47);
    expect(finalRes.err).to.equal(undefined);
    expect(fetchCalls.length).to.equal(2);
  });
});
