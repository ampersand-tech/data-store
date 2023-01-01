/**
 * Copyright 2017-present Ampersand Technologies, Inc.
 */

import { Overlay } from '../lib/dataOverlay';
import { IDataStore, WatcherOpt } from '../lib/dataStore';
import * as DataStoreWatch from '../lib/dataStoreWatch';

import * as SchemaType from 'amper-schema/dist/types';
import * as ObjUtils from 'amper-utils/dist/objUtils';
import { Stash } from 'amper-utils/dist/types';
import { expect } from 'chai';
import { describe, it } from 'mocha';

class TestStore implements IDataStore {
  static readonly schema = {
    MyStore: {
      string_key: SchemaType.STRING,
      first: {
        bar: {
          baz: {
            nn: SchemaType.STRING,
            nullable: SchemaType.STRING_NULLABLE,
          },
        },
        second: SchemaType.STRING,
      },

      map: {
        _ids: {
          field: SchemaType.STRING,
        },
      },
    },
  };

  watchTracker = DataStoreWatch.createWatchTracker(this, 'TestStore');

  getSchema(path: string[]) {
    let schema: Stash = TestStore.schema;
    for (let p of path) {
      if ('_ids' in schema) {
        schema = schema._ids;
        continue;
      }
      schema = schema[p];

      if (!schema) {
        break;
      }
    }
    return schema;
  }

  getData(_watcher: WatcherOpt, _path: string[], _mask: any) {
    return null;
  }

  getWatchTracker() {
    return this.watchTracker;
  }
}

function makeDefaultData(schema: Stash) {
  const result = {};

  for (const k in schema) {
    const s = schema[k];
    if ('_ids' in s) {
      result[k] = {};
    } else if ('_getDefaultValue' in s) {
      result[k] = s._getDefaultValue();
    } else {
      result[k] = makeDefaultData(s);
    }
  }

  return result;
}

describe('Overlay', function() {
  const nullStore = new TestStore;
  let store: Overlay;
  let calls: any[];
  let watcher: DataStoreWatch.Watcher;

  let activeWatchers: DataStoreWatch.Watcher[];

  function makeWatcher(a: any[], overrideStore?: IDataStore) {
    const newWatcher = DataStoreWatch.createWatcher(0, (_watcher, changes) => a.push(...changes), false, overrideStore || store);
    activeWatchers.push(newWatcher);
    return newWatcher;
  }

  const gConsoleError = console.error;
  before(() => {
    console.error = (err: string) => {
      throw new Error(err);
    }
  });
  after(() => {
    console.error = gConsoleError;
  });

  beforeEach(() => {
    store = new Overlay(nullStore);
    store.replaceData([], makeDefaultData(TestStore.schema));

    activeWatchers = [];
    calls = [];
    watcher = makeWatcher(calls);
  });

  afterEach(async () => {
    for (const w of activeWatchers) {
      DataStoreWatch.destroyWatcher(w);
    }
    await DataStoreWatch.flushWatches();
  });

  it('read through', function() {
    store.replaceData(['MyStore', 'first', 'bar', 'baz', 'nn'], 'baz');

    expect(store.getData(null, ['MyStore', 'first'])).to.deep.equal({bar: {baz: {nn: 'baz', nullable: null}}, second: ''});
    expect(store.getData(null, ['MyStore', 'first', 'bar', 'baz', 'nn'])).to.deep.equal('baz');

    const overlay = new Overlay(store);
    expect(overlay.getData(null, ['MyStore', 'first', 'bar', 'baz', 'nn'], 1)).to.deep.equal('baz');
  });

  it('reads through "falsy" values', function() {
    store.replaceData(['MyStore', 'string_key'], 'asdf');

    const overlay = new Overlay(store);
    overlay.replaceData(['MyStore', 'string_key'], '');

    expect(overlay.getData(null, ['MyStore', 'string_key'])).to.equal('');
  });

  it('masks', function() {
    store.replaceData(['MyStore', 'first', 'bar', 'baz'], {nn: 'nn', nullable: 'not null this time'});
    store.replaceData(['MyStore', 'first', 'second'], 'second str');

    expect(store.getData(
      null,
      ['MyStore'],
      ObjUtils.objectMakeImmutable({first: {bar: {baz: {nn: 1}}, second: 1}})),
    ).to.deep.equal({
      first: {
        bar: {
          baz: {
            nn: 'nn',
          },
        },
        second: 'second str',
      },
    });
  });

  it('permits writes', function() {
    store.replaceData(['MyStore', 'first', 'bar', 'baz', 'nn'], 'nn');

    const overlay = new Overlay(store);
    overlay.replaceData(['MyStore', 'first', 'second'], 'nn');

    expect(overlay.getData(null, ['MyStore', 'first'])).to.deep.equal({
      bar: {
        baz: {
          nn: 'nn',
          nullable: null,
        },
      },
      second: 'nn',
    });
  });

  describe('resetData', function() {
    it('reset one value', function() {
      store.replaceData(['MyStore', 'string_key'], 'original string');
      const overlay = new Overlay(store);
      overlay.replaceData(['MyStore', 'string_key'], 'another string');
      expect(overlay.getData(null, ['MyStore', 'string_key'])).to.equal('another string');
      overlay.resetData(['MyStore', 'string_key']);
      expect(overlay.getData(null, ['MyStore', 'string_key'])).to.equal('original string');
    });

    it('reset all values', function() {
      store.replaceData(['MyStore', 'string_key'], 'original string');
      const overlay = new Overlay(store);
      overlay.replaceData(['MyStore', 'string_key'], 'another string');
      expect(overlay.getData(null, ['MyStore', 'string_key'])).to.equal('another string');
      overlay.resetData();
      expect(overlay.getData(null, ['MyStore', 'string_key'])).to.equal('original string');
    });

    it('triggers watches', async () => {
      store.updateData(['MyStore', 'first', 'second'], 'old value');
      const overlay = new Overlay(store);
      overlay.updateData(['MyStore', 'first', 'second'], 'new value');
      expect(overlay.getData(watcher, ['MyStore', 'first', 'second'])).to.equal('new value');

      overlay.resetData();

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.lengthOf(1);
    });

    it('only triggers relevant watches', async () => {
      store.createData(['MyStore', 'map', '1'], {field: '1'});
      store.createData(['MyStore', 'map', '2'], {field: '2'});

      const a1 = [];
      const watcher1 = makeWatcher(a1);
      const a2 = [];
      const watcher2 = makeWatcher(a2);
      const a3 = [];
      const watcher3 = makeWatcher(a3);

      const overlay = new Overlay(store);
      overlay.removeData(['MyStore', 'map', '1']);

      overlay.getData(watcher1, ['MyStore', 'map', '1']);
      overlay.getData(watcher2, ['MyStore', 'map', '2']);
      overlay.getData(watcher3, ['MyStore', 'map']);

      overlay.resetData(['MyStore', 'map', '1']);

      await DataStoreWatch.flushWatches();
      expect(a1).to.have.lengthOf(1);
      expect(a2).to.have.lengthOf(0);
      expect(a3).to.have.lengthOf(1);
    });

    it("it's ok to reset data that hasn't been set to begin with", function() {
      const overlay = new Overlay(store);
      overlay.resetData(['MyStore', 'map']);
    });

    it('restores deleted data', function() {
      store.createData(['MyStore', 'map', '1'], {field: '1'});
      const overlay = new Overlay(store);
      overlay.removeData(['MyStore', 'map', '1']);
      overlay.resetData(['MyStore', 'map', '1']);
      expect(overlay.getData(null, ['MyStore', 'map', '1'])).to.deep.equal({field: '1'});
    });
  });

  describe('replaceData', function() {
    it('creates nested partial data structures as needed', function() {
      const overlay = new Overlay(store);
      overlay.replaceData(['MyStore', 'first', 'bar', 'baz'], {nn: 'nn'});
    });

    it('enforces schema', function() {
      expect(() => store.replaceData(['MyStore', 'first'], 'not allowed')).to.throw();
    });

    it('disallows creating random goop in places where it does not belong', function() {
      expect(() => store.replaceData(['MyStore', 'donotexist'], 'what')).to.throw();
    });

    it('allows creating anything in schema-less stores', function() {
      expect(() => store.replaceData(['NoSchemaStore', 'donotexist'], 'what')).to.not.throw();
    });

    it('disallows obliterating subtrees', function() {
      expect(() => store.replaceData(['MyStore', 'first'], null)).to.throw();
    });

    it('disallows deleting something non-nullable', function() {
      expect(() => store.replaceData(['MyStore', 'first', 'bar', 'baz', 'nn'], null)).to.throw();
    });

    it('disallows deleting a nullable subobject', function() {
      expect(() => store.replaceData(['MyStore', 'first'], null)).to.throw();
    });

    it('permits setting null to nullable field', function() {
      store.replaceData(['MyStore', 'first', 'bar', 'baz', 'nullable'], null);
    });

    it('forbids omitting a non-nullable field', function() {
      expect(() => store.replaceData(['MyStore', 'first', 'bar', 'baz'], {nullable: 'not null'})).to.throw();
    });

    it('clobbers a nullable field if it is not provided as part of the new data', function() {
      store.replaceData(['MyStore', 'first', 'bar', 'baz'], {nn: 'still not null'});
      expect(store.getData(null, ['MyStore', 'first', 'bar', 'baz', 'nullable'])).to.be.null;
    });

    it('can delete map keys that are present in the backing store', function() {
      store.createData(['MyStore', 'map', 'id1'], {field: 'value'});

      const overlay = new Overlay(store);
      overlay.replaceData(['MyStore', 'map'], {});

      expect(overlay.getData(null, ['MyStore', 'map'])).to.deep.equal({});
    });

    it('can operate on arrays', function() {
      store.createData(['SchemaLessStore', 'arr'], [{field: 'value1'}, {field: 'value2'}]);

      const overlay = new Overlay(store);
      overlay.replaceData(['SchemaLessStore', 'arr', '1'], {field: 'value3'});

      expect(overlay.getData(null, ['SchemaLessStore', 'arr'])).to.deep.equal([{field: 'value1'}, {field: 'value3'}]);
    });

    it('triggers watches', async () => {
      store.replaceData(['MyStore', 'string_key'], 'value');
      store.getData(watcher, ['MyStore', 'string_key']);
      store.replaceData(['MyStore', 'string_key'], 'second value');

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(1);
    });
  });

  describe('getData', function() {
    it('omits map elements removed with .removeData()', function() {
      store.createData(['MyStore', 'map', 'id1'], {field: 'value1'});
      store.createData(['MyStore', 'map', 'id2'], {field: 'value2'});

      const overlay = new Overlay(store);
      overlay.removeData(['MyStore', 'map', 'id1']);

      expect(overlay.getData(null, ['MyStore', 'map'])).to.deep.equal({id2: {field: 'value2'}});
    });

    it('omits map elements removed with .replaceData()', function() {
      store.createData(['MyStore', 'map', 'id1'], {field: 'value1'});
      store.createData(['MyStore', 'map', 'id2'], {field: 'value2'});

      const overlay = new Overlay(store);
      overlay.replaceData(['MyStore', 'map'], {id2: {field: 'value2'}});

      expect(overlay.getData(null, ['MyStore', 'map'])).to.deep.equal({id2: {field: 'value2'}});
    });

    it('treats the mask \'*\' the same way as no mask at all', function() {
      store.createData(['MyStore', 'map', 'id1'], {field: 'value1'});
      store.createData(['MyStore', 'map', 'id2'], {field: 'value2'});

      const overlay = new Overlay(store);
      overlay.replaceData(['MyStore', 'map'], {id2: {field: 'value2'}});

      expect(overlay.getData(null, ['MyStore', 'map'], '*')).to.deep.equal({id2: {field: 'value2'}});
    });

    describe('with a mask', function() {
      // Other parts of the application seem to depend on this not happening
      it.skip('bad masks should throw', function() {
        expect(() =>
          store.getData(null, ['MyStore', 'map', 'this is wrong'], Object.freeze({lalala: 1, this_is_bs: 1})),
        ).to.throw('Overlay objMask does not match schema');
      });

      it('returns null for data that is not present', function() {
        const res = store.getData(null, ['MyStore', 'map', 'this is wrong'], Object.freeze({field: 1}));
        expect(res).to.deep.equal(null);
      });
    });
  });

  describe('createData', function() {
    it('inserts into a map', function() {
      store.createData(['MyStore', 'map', 'id_1'], {field: 'value'});
      expect(store.getData(null, ['MyStore', 'map', 'id_1'])).to.deep.equal({field: 'value'});
    });

    it('fails if there is already data', function() {
      store.createData(['MyStore', 'map', 'id_1'], {field: 'value'});
      expect(() => store.createData(['MyStore', 'map', 'id_1'], {field: 'value'})).to.throw();
    });

    it('fails if it is overlaying existing data', function() {
      store.createData(['MyStore', 'map', 'id1'], {field: 'set'});

      const overlay = new Overlay(store);
      expect(() => overlay.createData(['MyStore', 'map', 'id1'], {field: 'this can never work'})).to.throw();
    });

    it('checks schema', function() {
      expect(() => store.createData(['MyStore', 'map', 'id_1'], {field: 99})).to.throw();
      expect(() => store.createData(['MyStore', 'map', 'id_1'], {wrong_field: 'no good'})).to.throw();
      expect(() => store.createData(['MyStore', 'first', 'bar'], {wrong_field: 'no good'})).to.throw();
      expect(() => store.createData(['MyStore', 'mop'], {})).to.throw();
    });

    it('triggers watches', async () => {
      store.getData(watcher, ['MyStore', 'map', 'id1']);
      store.createData(['MyStore', 'map', 'id1'], {field: 'second value'});

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(1);
    });
  });

  describe('updateData', function() {
    it('updates a scalar', function() {
      store.updateData(['MyStore', 'string_key'], 'a new value');
      expect(store.getData(null, ['MyStore', 'string_key'])).to.equal('a new value');
    });

    it('incrementally updates an object', function() {
      store.updateData(['MyStore', 'first', 'bar', 'baz'], {nullable: 'not null'});
      expect(store.getData(null, ['MyStore', 'first', 'bar', 'baz'])).to.deep.equal({nn: '', nullable: 'not null'});
    });

    it('enforces schema', function() {
      expect(() => store.updateData(['MyStore', 'misspelled'], 'lalala')).to.throw();
      expect(() => store.updateData(['MyStore', 'string_key'], 44)).to.throw();
      expect(() => store.updateData(['MyStore', 'first', 'bar', 'baz'], {misspelled_field: 'lalala'})).to.throw();
      expect(() => store.updateData(['MyStore', 'first', 'bar', 'baz'], {nullable: 9})).to.throw();
    });

    it('triggers watches', async () => {
      store.getData(watcher, ['MyStore', 'string_key']);
      store.updateData(['MyStore', 'string_key'], 'second value');

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(1);
    });

    it('updates part of an object from the backing store', function() {
      const overlay = new Overlay(store);

      store.updateData(['MyStore', 'first', 'bar', 'baz'], {nullable: 'not null this time'});
      overlay.replaceData(['MyStore', 'first', 'bar', 'baz', 'nn'], 'value');

      expect(overlay.getData(null, ['MyStore', 'first', 'bar', 'baz'])).to.deep.equal({
        nn: 'value',
        nullable: 'not null this time',
      });

      expect(store.getData(null, ['MyStore', 'first', 'bar', 'baz'])).to.deep.equal({
        nn: '',
        nullable: 'not null this time',
      });
    });

    it("updates sub-objects that are not yet present in the overlay's sparse store", function() {
      store.createData(['MyStore', 'map', '1'], {field: 'one'});
      store.createData(['MyStore', 'map', '2'], {field: 'two'});

      const overlay = new Overlay(store);
      overlay.updateData(['MyStore', 'map'], {
        '1': {field: 'ONE'},
        '2': {field: 'TWO'},
      });

      expect(overlay.getData(null, ['MyStore', 'map', '1', 'field'])).to.equal('ONE');
      expect(overlay.getData(null, ['MyStore', 'map', '2', 'field'])).to.equal('TWO');
    });
  });

  describe('removeData', function() {
    it('forbids removing non-nullable data', function() {
      expect(() => store.removeData(['MyStore', 'first'])).to.throw();
    });

    it('allows deleting nullable data', function() {
      store.removeData(['MyStore', 'first', 'bar', 'baz', 'nullable']);
    });

    it('allow removing a map item that is present in the backing store', function() {
      store.createData(['MyStore', 'map', 'id1'], {field: 'value1'});
      store.createData(['MyStore', 'map', 'id2'], {field: 'value2'});

      const overlay = new Overlay(store);
      overlay.removeData(['MyStore', 'map', 'id1']);

      expect(store.getData(null, ['MyStore', 'map'], ObjUtils.objectMakeImmutable({_ids: 1}))).to.have.keys(['id1', 'id2']);
      expect(overlay.getData(null, ['MyStore', 'map'])).to.deep.equal({id2: {field: 'value2'}});
    });

    it('allow creating new data in place of deleted data', function() {
      store.createData(['MyStore', 'map', 'id1'], {field: 'value1'});
      store.createData(['MyStore', 'map', 'id2'], {field: 'value2'});

      const overlay = new Overlay(store);
      overlay.removeData(['MyStore', 'map', 'id1']);
      overlay.createData(['MyStore', 'map', 'id1'], {field: 'new value'});

      expect(store.getData(null, ['MyStore', 'map'])).to.deep.equal({
        id1: {field: 'value1'},
        id2: {field: 'value2'},
      });

      expect(overlay.getData(null, ['MyStore', 'map'])).to.deep.equal({
        id1: {field: 'new value'},
        id2: {field: 'value2'},
      });
    });

    it('triggers watches', async () => {
      store.createData(['MyStore', 'map', 'id1'], {field: 'value'});
      store.getData(watcher, ['MyStore', 'map', 'id1']);
      store.removeData(['MyStore', 'map', 'id1']);
      await DataStoreWatch.flushWatches();
      expect(calls).to.have.lengthOf(1);
    });
  });

  describe('watches', function() {
    it('triggers watchers when changes occur', async () => {
      store.replaceData(['MyStore', 'string_key'], 'value');
      store.getData(watcher, ['MyStore', 'string_key']);
      store.replaceData(['MyStore', 'string_key'], 'second value');

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(1);
    });

    it("don't trigger watches for unrelated reads", async () => {
      store.replaceData(['MyStore', 'string_key'], 'value');
      store.getData(watcher, ['MyStore', 'string_key']);
      store.replaceData(['MyStore', 'first', 'second'], 'unrelated value');

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(0);
    });

    it('resetWatches', async () => {
      store.replaceData(['MyStore', 'string_key'], 'value');
      store.getData(watcher, ['MyStore', 'string_key']);
      store.replaceData(['MyStore', 'string_key'], 'exciting value');
      store.replaceData(['MyStore', 'string_key'], 'amazing value');

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(1);
    });

    it('watches are fired when the backing data store changes too', async () => {
      store.replaceData(['MyStore', 'first', 'second'], 'value');
      const overlay = new Overlay(store);

      const outerCalls: any[] = [];
      const outerWatcher = makeWatcher(outerCalls);

      const innerCalls: any[] = [];
      const innerWatcher = makeWatcher(innerCalls);

      store.getData(outerWatcher, ['MyStore', 'first', 'second']);
      overlay.getData(innerWatcher, ['MyStore', 'first', 'second']);

      store.replaceData(['MyStore', 'first', 'second'], 'new value');

      await DataStoreWatch.flushWatches();
      expect(outerCalls).to.have.lengthOf(1);
      expect(innerCalls).to.have.lengthOf(1);
    });

    it('does not fire watchers on the backing store when the change is applied to the overlay', async () => {
      store.replaceData(['MyStore', 'first', 'second'], 'value');
      const overlay = new Overlay(store);

      const outerCalls: any[] = [];
      const outerWatcher = makeWatcher(outerCalls);

      const innerCalls: any[] = [];
      const innerWatcher = makeWatcher(innerCalls, overlay);

      store.getData(outerWatcher, ['MyStore', 'first', 'second']);
      overlay.getData(innerWatcher, ['MyStore', 'first', 'second']);

      overlay.replaceData(['MyStore', 'first', 'second'], 'new value');

      await DataStoreWatch.flushWatches();
      expect(outerCalls).to.have.lengthOf(0);
      expect(innerCalls).to.have.lengthOf(1);
    });

    it('subtree modifications trigger watchers for base keys', async () => {
      store.getData(watcher, ['MyStore', 'map']);
      store.createData(['MyStore', 'map', 'id1'], {field: 'second value'});

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(1);
    });

    it('a watch that is added while triggering watches is not itself synchronously called', async () => {
      const loopyWatcher = DataStoreWatch.createWatcher(0, (_watcher, _changes) => {
        store.getData(loopyWatcher, ['MyStore', 'map']);
      });

      store.getData(loopyWatcher, ['MyStore', 'map']);
      store.createData(['MyStore', 'map', 'id1'], {field: 'a value'});

      await DataStoreWatch.flushWatches();
    });

    it('triggers each watch as it changes', async () => {
      const secondResults: any[] = [];
      const secondWatcher = makeWatcher(secondResults);

      store.getData(watcher, ['MyStore', 'map', 'id1']);
      store.getData(secondWatcher, ['MyStore', 'map', 'id2']);

      store.createData(['MyStore', 'map', 'id1'], {field: 'a value'});
      store.createData(['MyStore', 'map', 'id2'], {field: 'second value'});

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(1);
      expect(secondResults).to.have.length(1);
    });

    it('watches only trigger once', async () => {
      store.getData(watcher, ['MyStore', 'map']);
      store.createData(['MyStore', 'map', 'id1'], {field: 'a value'});
      store.updateData(['MyStore', 'map', 'id1'], {field: 'another value'});

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.lengthOf(1);
    });

    it('triggers each watch as it changes', async () => {
      const secondResults: any[] = [];
      const secondWatcher = makeWatcher(secondResults);

      store.getData(watcher, ['MyStore', 'map', 'id1']);
      store.getData(secondWatcher, ['MyStore', 'map', 'id2']);

      store.createData(['MyStore', 'map', 'id1'], {field: 'a value'});
      store.createData(['MyStore', 'map', 'id2'], {field: 'second value'});

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.length(1);
      expect(secondResults).to.have.length(1);
    });
  });

  describe('hasChanges', function() {
    it('you can ask if a subtree has changes', function() {
      const overlay = new Overlay(store);
      expect(overlay.hasChanges(null, ['MyStore', 'string_key'])).to.be.false;

      overlay.updateData(['MyStore', 'string_key'], 'hello');
      expect(overlay.hasChanges(null, ['MyStore', 'string_key'])).to.be.true;
    });

    it('will not report changes if the new value is equal to the old', function() {
      const overlay = new Overlay(store);
      expect(overlay.hasChanges(null, ['MyStore', 'string_key'])).to.be.false;

      overlay.updateData(['MyStore', 'string_key'], store.getData(null, ['MyStore', 'string_key']));
      expect(overlay.hasChanges(null, ['MyStore', 'string_key'])).to.be.false;
    });

    it('reports changed if you change a subkey', function() {
      const overlay = new Overlay(store);
      expect(overlay.hasChanges(null, ['MyStore', 'first', 'bar'])).to.be.false;

      overlay.updateData(['MyStore', 'first', 'bar', 'baz', 'nn'], 'New String');
      expect(overlay.hasChanges(null, ['MyStore', 'first', 'bar'])).to.be.true;
    });

    it('will not report changes if you have changed a subkey of the requested key to a value equal to the old', function() {
      const overlay = new Overlay(store);
      expect(overlay.hasChanges(null, ['MyStore', 'first', 'bar'])).to.be.false;

      overlay.updateData(['MyStore', 'first', 'bar', 'baz', 'nn'], store.getData(null, ['MyStore', 'first', 'bar', 'baz', 'nn']));
      expect(overlay.hasChanges(null, ['MyStore', 'first', 'bar'])).to.be.false;
    });

    it('registers a watch', async () => {
      const overlay = new Overlay(store);

      expect(overlay.hasChanges(watcher, ['MyStore', 'string_key'])).to.be.false;
      overlay.updateData(['MyStore', 'string_key'], 'new value');

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.lengthOf(1);
    });

    it('registers a watch on the backing store too', async () => {
      const overlay = new Overlay(store);

      expect(overlay.hasChanges(watcher, ['MyStore', 'string_key'])).to.be.false;
      store.updateData(['MyStore', 'string_key'], 'new value');

      await DataStoreWatch.flushWatches();
      expect(calls).to.have.lengthOf(1);
    });
  });
});
