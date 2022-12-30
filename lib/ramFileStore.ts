/**
* Copyright 2015-present Ampersand Technologies, Inc.
*/

import { FindDirData, IFileStore } from './dataStorePersist';

import * as JsonUtils from 'amper-utils/dist/jsonUtils';
import * as ObjUtils from 'amper-utils/dist/objUtils';
import { Stash } from 'amper-utils/dist/types';

export class RamFileStore implements IFileStore {
  private storage: Stash<string> = {};

  async windowReadAll() {
    return {};
  }

  async windowWrite(_key: string, _data: any) {
  }

  async find<T>(key: string): Promise<T|undefined> {
    let data = this.storage[key];
    if (data) {
      return JsonUtils.safeParse(data);
    }
    return undefined;
  }

  async findDir<T>(dir: string): Promise<FindDirData<T>> {
    const results: FindDirData<T> = {
      paths: [] as string[],
      objects: [] as any[],
    };
    for (const key in this.storage) {
      if (key.indexOf(dir) === 0) {
        results.paths.push(key);
        results.objects.push(JsonUtils.safeParse(this.storage[key]));
      }
    }
    return results;
  }

  async update(key: string, data: any) {
    this.storage[key] = JsonUtils.safeStringify(data);
  }

  async remove(key: string) {
    delete this.storage[key];
  }

  async removeList(keys: string[]) {
    for (let i = 0; i < keys.length; ++i) {
      delete this.storage[keys[i]];
    }
  }

  async removeDir(dir: string) {
    for (const key in this.storage) {
      if (key.indexOf(dir) === 0) {
        delete this.storage[key];
      }
    }
  }

  async removeAllExcept(exceptKeys: string[]) {
    const newStorage = {};
    for (const key in this.storage) {
      if (exceptKeys.includes(key)) {
        newStorage[key] = this.storage[key];
      }
    }
    this.storage = newStorage;
  }

  localBroadcast(/*cmd, obj*/) {
  }

  registerLocalMessageHandler(/*msg, handler*/) {
  }

  test_getData() {
    return ObjUtils.clone(this.storage);
  }

  test_setData(data: Stash) {
    this.storage = ObjUtils.clone(data);
  }
}
