// time curl -v -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"invoke", "params": {"name": "hello"}, "id":1}' https://api.example.resdir.com

export default base =>
  class Example extends base {
    hello() {
      // throw new Error('Something went wrong');
      return this.message;
    }
  };
