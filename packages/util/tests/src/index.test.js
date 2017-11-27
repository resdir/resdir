import * as util from '../..';

describe('@resdir/util', () => {
  test('compactObject()', () => {
    let obj = {a: 1, b: undefined};
    obj = util.compactObject(obj);
    expect(obj.a).toBe(1);
    expect('b' in obj).toBe(false);
  });
});
