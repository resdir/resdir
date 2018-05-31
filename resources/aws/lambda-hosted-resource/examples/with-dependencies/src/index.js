// time curl -v -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"invoke", "params": {"name": "hello", "version": 1}, "id":1}' https://with-deps.example.resdir.com

import upper from './upper';

export default () => ({
  hello() {
    return upper(this.message);
  }
});
