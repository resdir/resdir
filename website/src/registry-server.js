/* global Resource */

import constants from './constants';

let _registryServer;

export async function getRegistryServer() {
  if (!_registryServer) {
    _registryServer = await Resource.$import(constants.RESDIR_REGISTRY_SERVER);
  }
  return _registryServer;
}
