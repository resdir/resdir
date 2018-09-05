const secretCache = {};

export async function getSecret({secretId, secretsManager}, _environment) {
  if (secretCache[secretId]) {
    return secretCache[secretId];
  }

  const {SecretString: secret} = await secretsManager.getSecretValue({SecretId: secretId});

  secretCache[secretId] = secret;

  return secret;
}
