import {join} from 'path';
import {Resource} from 'run-core';

const RESOURCE_PATH = join(__dirname, '..', '..', '..');

describe('resdir/resource', () => {
  test('id', async () => {
    const res = await Resource.$import(RESOURCE_PATH);
    expect(res.$getChild('id')).toBeDefined();
    expect(res.id).toBeUndefined();
    expect(await res.$getChild('id').getNamespace()).toBeUndefined();
    expect(await res.$getChild('id').getName()).toBeUndefined();

    res.id = 'resdir/hello';
    expect(res.id).toBe('resdir/hello');
    expect(await res.$getChild('id').getNamespace()).toBe('resdir');
    expect(await res.$getChild('id').getName()).toBe('hello');
    expect(await res.$getChild('id').validate()).toBe(true);

    res.id = 'resdir/-invalid-name-';
    expect(await res.$getChild('id').validate({throwIfInvalid: false})).toBe(false);
    await expect(res.$getChild('id').validate()).rejects.toBeInstanceOf(Error);
  });

  test('version', async () => {
    const res = await Resource.$import(RESOURCE_PATH);
    expect(res.$getChild('version')).toBeDefined();
    expect(res.version).toBeUndefined();
    expect(await res.$getChild('version').validate({throwIfInvalid: false})).toBe(false);

    res.version = '1.2.3';
    expect(res.version).toBe('1.2.3');
    expect(await res.$getChild('version').validate()).toBe(true);

    res.version = '1.2.3.4';
    expect(res.version).toBe('1.2.3.4');
    expect(await res.$getChild('version').validate({throwIfInvalid: false})).toBe(false);
    await expect(res.$getChild('version').validate()).rejects.toBeInstanceOf(Error);
  });

  test('isPublic', async () => {
    const res = await Resource.$import(RESOURCE_PATH);
    expect(res.isPublic).toBe(false);

    res.isPublic = true;
    expect(res.isPublic).toBe(true);
  });
});
