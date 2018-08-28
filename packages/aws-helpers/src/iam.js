const usernameCache = {};

export async function getIAMUsername({iam}, _environment) {
  const {accessKeyId} = iam.client.config;
  if (!accessKeyId) {
    throw new Error(`Coudn't determine your AWS Access Key ID`);
  }

  if (usernameCache[accessKeyId]) {
    return usernameCache[accessKeyId];
  }

  const {UserName: username} = await iam.getAccessKeyLastUsed({AccessKeyId: accessKeyId});

  usernameCache[accessKeyId] = username;

  return username;
}
