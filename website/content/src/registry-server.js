/* global Resource */

let _registryServer;

export async function getRegistryServer() {
  if (!_registryServer) {
    _registryServer = await Resource.$import(process.env.RESDIR_REGISTRY_SERVER_SPECIFIER);
  }
  return _registryServer;
}
