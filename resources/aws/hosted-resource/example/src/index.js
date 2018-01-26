// time curl -v -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"getMethods","id":1}' https://api.example.resdir.com

// time curl -v -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"invokeMethod", "params": {"name": "hello"}, "id":1}' https://api.example.resdir.com

export default base =>
  class Example extends base {
    hello() {
      return this.message;
    }
  };
