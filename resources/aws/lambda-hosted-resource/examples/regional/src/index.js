// time curl -v -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"invoke", "params": {"name": "hello", "version": 1}, "id":1}' https://us-east-2.example.resdir.com

// Speed tests (using Postman):
// - Home to ap-northeast-1 using an edge-optimized endpoint: 75ms
// - Home to ap-northeast-1 using a regional endpoint: 65ms
// - Home to us-east-2 using an edge-optimized endpoint: ?ms
// - Home to us-east-2 using a regional endpoint: 270ms

export default () => ({
  hello() {
    // throw new Error('Something went wrong!');
    return this.message;
  }
});
