// time curl -v -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"invoke", "params": {"name": "hello", "version": 1}, "id":1}' https://api.example.resdir.com

export default () => ({
  hello() {
    // throw new Error('Something went wrong');
    return this.message;
  }
});
