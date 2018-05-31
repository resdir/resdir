export default () => ({
  RESOURCE_ID: 'aws/lambda-hosted-resource',

  MANAGER_IDENTIFIER: 'aws-lambda-hosted-resource-v1',

  async deploy(_input, environment) {
    await this.aroundDeploy(async () => {
      const iamLambdaRoleHasJustBeenCreated = await this.ensureIAMLambdaRole(environment);
      await this.createOrUpdateLambdaFunction({iamLambdaRoleHasJustBeenCreated}, environment);
      await this.ensureACMCertificate(environment);
      await this.createOrUpdateAPIGateway(environment);
      await this.createOrUpdateAPIGatewayDomainName(environment);
    });
  }
});
