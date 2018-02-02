import {isEqual} from 'lodash';
import {task, formatString} from '@resdir/console';
import {APIGateway} from '@resdir/aws-client';

const STAGE_NAME = 'main';

export default () => ({
  async createOrUpdateAPIGateway(environment) {
    await task(
      async progress => {
        const api = await this.getAPIGateway({throwIfNotFound: false});
        if (!api) {
          progress.setMessage('Creating API Gateway...');
          progress.setOutro('API Gateway created');
          await this.createAPIGateway();
          await this.allowLambdaFunctionInvocationFromAPIGateway();
        } else {
          await this.checkAPIGatewayTags();
        }
      },
      {
        intro: `Checking API Gateway...`,
        outro: `API Gateway checked`
      },
      environment
    );
  },

  async getAPIGateway({throwIfNotFound = true} = {}) {
    if (!this._apiGateway) {
      const apiGateway = this.getAPIGatewayClient();

      const limit = 500;
      const {items} = await apiGateway.getRestApis({limit});
      if (items.length === limit) {
        throw new Error(`Whoa, you have a lot of API Gateways! Unfortunately, this tool can't list them all. Please post an issue on Resdir's GitHub if this is a problem for you.`);
      }

      const name = this.getAPIGatewayName();
      const item = items.find(item => item.name === name);
      if (item) {
        this._apiGateway = {id: item.id};
      }
    }

    if (!this._apiGateway && throwIfNotFound) {
      throw new Error('API Gateway not found');
    }

    return this._apiGateway;
  },

  async createAPIGateway() {
    const apiGateway = this.getAPIGatewayClient();

    const {id: restApiId} = await apiGateway.createRestApi({
      name: this.getAPIGatewayName(),
      endpointConfiguration: {types: ['REGIONAL']}
    });

    const result = await apiGateway.getResources({restApiId});
    const resourceId = result.items[0].id;

    // POST method

    await apiGateway.putMethod({
      restApiId,
      resourceId,
      httpMethod: 'POST',
      authorizationType: 'NONE'
    });

    await apiGateway.putMethodResponse({
      restApiId,
      resourceId,
      httpMethod: 'POST',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true
      }
    });

    const region = this.getAPIGatewayRegion();
    const lambdaFunction = await this.getLambdaFunction();
    await apiGateway.putIntegration({
      restApiId,
      resourceId,
      httpMethod: 'POST',
      type: 'AWS',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${
        lambdaFunction.arn
      }/invocations`
    });

    await apiGateway.putIntegrationResponse({
      restApiId,
      resourceId,
      httpMethod: 'POST',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': `'*'`
      }
    });

    // OPTIONS method (for CORS)

    await apiGateway.putMethod({
      restApiId,
      resourceId,
      httpMethod: 'OPTIONS',
      authorizationType: 'NONE'
    });

    await apiGateway.putMethodResponse({
      restApiId,
      resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true
      }
    });

    await apiGateway.putIntegration({
      restApiId,
      resourceId,
      httpMethod: 'OPTIONS',
      type: 'MOCK',
      requestTemplates: {
        'application/json': '{statusCode:200}'
      }
    });

    await apiGateway.putIntegrationResponse({
      restApiId,
      resourceId,
      httpMethod: 'OPTIONS',
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': `'*'`,
        'method.response.header.Access-Control-Allow-Headers': `'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'`,
        'method.response.header.Access-Control-Allow-Methods': `'POST,OPTIONS'`
      },
      responseTemplates: {
        'application/json': ''
      }
    });

    // Deployment

    const {id: deploymentId} = await apiGateway.createDeployment({restApiId});

    await apiGateway.createStage({
      restApiId,
      deploymentId,
      stageName: STAGE_NAME,
      tags: {'managed-by': this.MANAGER_IDENTIFIER}
    });

    this._apiGateway = {id: restApiId};
  },

  async checkAPIGatewayTags() {
    const stage = await this.getAPIGatewayStage({throwIfNotFound: false});
    const tags = stage && stage.tags;
    if (!isEqual(tags, {'managed-by': this.MANAGER_IDENTIFIER})) {
      throw new Error(`Can't manage an API Gateway not originally created by ${formatString(this.RESOURCE_ID)} (name: ${formatString(this.getAPIGatewayName())})`);
    }
  },

  async getAPIGatewayStage({throwIfNotFound = true} = {}) {
    const apiGateway = this.getAPIGatewayClient();
    const api = await this.getAPIGateway();
    try {
      return await apiGateway.getStage({restApiId: api.id, stageName: STAGE_NAME});
    } catch (err) {
      if (err.code === 'NotFoundException') {
        if (!throwIfNotFound) {
          return;
        }
        throw new Error('API Gateway stage not found');
      }
      throw err;
    }
  },

  async createOrUpdateAPIGatewayDomainName(environment) {
    await task(
      async progress => {
        let domainName = await this.getAPIGatewayDomainName({throwIfNotFound: false}, environment);

        if (!domainName) {
          progress.setMessage('Configuring custom domain name...');
          progress.setOutro('Custom domain name configured');
          domainName = await this.createAPIGatewayDomainName(environment);
        } else if (await this.checkIfAPIGatewayDomainNameBasePathMappingsHasChanged()) {
          progress.setMessage('Updating custom domain name...');
          progress.setOutro('Custom domain name updated');
          await this.updateAPIGatewayDomainNameBasePathMappings();
        }

        await this.ensureRoute53Alias(
          {
            name: this.domainName,
            targetDomainName: domainName.regionalDomainName,
            targetHostedZoneId: domainName.regionalHostedZoneId
          },
          environment
        );
      },
      {
        intro: `Checking custom domain name...`,
        outro: `Custom domain name checked`
      },
      environment
    );
  },

  async getAPIGatewayDomainName({throwIfNotFound = true} = {}, _environment) {
    if (!this._apiGatewayDomainName) {
      const apiGateway = this.getAPIGatewayClient();

      try {
        this._apiGatewayDomainName = await apiGateway.getDomainName({
          domainName: this.domainName
        });
      } catch (err) {
        if (err.code !== 'NotFoundException') {
          throw err;
        }
      }
    }

    if (!this._apiGatewayDomainName && throwIfNotFound) {
      throw new Error('API Gateway custom domain name not found');
    }

    return this._apiGatewayDomainName;
  },

  async createAPIGatewayDomainName(environment) {
    const apiGateway = this.getAPIGatewayClient();

    const certificate = await this.getACMCertificate(undefined, environment);
    const api = await this.getAPIGateway();

    const domainName = await apiGateway.createDomainName({
      domainName: this.domainName,
      regionalCertificateArn: certificate.arn,
      endpointConfiguration: {types: ['REGIONAL']}
    });

    await apiGateway.createBasePathMapping({
      domainName: this.domainName,
      restApiId: api.id,
      basePath: '',
      stage: STAGE_NAME
    });

    this._apiGatewayDomainName = domainName;

    return domainName;
  },

  async checkIfAPIGatewayDomainNameBasePathMappingsHasChanged() {
    const apiGateway = this.getAPIGatewayClient();

    const api = await this.getAPIGateway();

    const {items: mappings} = await apiGateway.getBasePathMappings({domainName: this.domainName});

    if (!isEqual(mappings, [{basePath: '(none)', restApiId: api.id, stage: STAGE_NAME}])) {
      return true;
    }

    return false;
  },

  async updateAPIGatewayDomainNameBasePathMappings() {
    const apiGateway = this.getAPIGatewayClient();

    const {items: mappings} = await apiGateway.getBasePathMappings({domainName: this.domainName});
    for (const mapping of mappings) {
      await apiGateway.deleteBasePathMapping({
        domainName: this.domainName,
        basePath: mapping.basePath
      });
    }

    const api = await this.getAPIGateway();

    await apiGateway.createBasePathMapping({
      domainName: this.domainName,
      restApiId: api.id,
      basePath: '',
      stage: STAGE_NAME
    });
  },

  getAPIGatewayName() {
    return this.domainName;
  },

  getAPIGatewayRegion() {
    return this.aws && ((this.aws.apiGateway && this.aws.apiGateway.region) || this.aws.region);
  },

  getAPIGatewayClient() {
    if (!this._apiGatewayClient) {
      this._apiGatewayClient = new APIGateway(this.aws);
    }
    return this._apiGatewayClient;
  }
});
