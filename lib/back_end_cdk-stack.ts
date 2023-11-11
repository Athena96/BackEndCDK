import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";

export class BackEndCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Defing Dynamo DB Tables

    // Scenarios Table
    const scenariosTable = new dynamodb.Table(this, 'MoneyApp-Scenarios', {
      tableName: 'MoneyApp-Scenario',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'active', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // Change as per your needs
    })


    // Data Table
    const dataTable = new dynamodb.Table(this, 'MoneyApp-Data', {
      tableName: 'MoneyApp-ScenarioData',
      partitionKey: { name: 'scenarioDataId', type: dynamodb.AttributeType.STRING }, // email_scenarioId
      sortKey: { name: 'type', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // Change as per your needs
    });

    // Role for Lambda
    const lambdaRole = new iam.Role(this, 'BackendAPILambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'));
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

    // Define the Lambda function
    const helloLambda = new lambda.Function(this, "BackendHandler", {
      runtime: lambda.Runtime.JAVA_17, // execution environment
      code: lambda.Code.fromAsset(
        "../BackEnd/target/my-service-1.0-SNAPSHOT-lambda-package.zip"
      ), // code loaded from the "lambda" directory
      handler: "my.service.StreamLambdaHandler::handleRequest", // file is "hello", function is "handler"
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      role: lambdaRole,

      environment: {
        SCENARIO_TABLE: scenariosTable.tableName,
        DATA_TABLE: dataTable.tableName,
      },
    });

    const version = helloLambda.currentVersion;
    const alias = new lambda.Alias(this, 'LambdaAlias2', {
      aliasName: 'Prod2',
      version,
    });

    alias.addAutoScaling({
      minCapacity: 2,
      maxCapacity: 10
    });

    // Enable SnapStart
    const cfnFunction = helloLambda.node.defaultChild as lambda.CfnFunction;
    cfnFunction.addPropertyOverride("SnapStart", { ApplyOn: "PublishedVersions" });

    // Define the API Gateway
    const helloApi = new apigw.LambdaRestApi(this, "Endpoint", {
      handler: helloLambda,
      proxy: false,
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS, // this is also the default setting
      },
    });

    // Define Cognito User Pool
    const userPool = new cognito.UserPool(this, "MyUserPool", {
      selfSignUpEnabled: true, // allow users to sign up
      autoVerify: { email: true }, // verify email addresses by sending a verification code
      signInAliases: { email: true }, // set email as an alias
    });

    const userPoolClient = new cognito.UserPoolClient(
      this,
      "MyUserPoolClient",
      {
        userPool: userPool,
      }
    );

    // Create a custom authorizer using the Lambda function and Cognito user pool
    const auth = new apigw.CfnAuthorizer(this, "APIGatewayAuthorizer", {
      name: "customer-authorizer",
      identitySource: "method.request.header.Authorization",
      providerArns: [userPool.userPoolArn],
      restApiId: helloApi.restApiId,
      type: apigw.AuthorizationType.COGNITO,
    });

    helloApi.root
      .resourceForPath("ping")
      .addMethod("POST", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("listScenarios")
      .addMethod("GET", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("getScenarioData")
      .addMethod("GET", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("listAssets")
      .addMethod("GET", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("listRecurring")
      .addMethod("GET", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("listOneTime")
      .addMethod("GET", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("getSettings")
      .addMethod("GET", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("addAsset")
      .addMethod("POST", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("updateAsset")
      .addMethod("PUT", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("deleteAsset")
      .addMethod("DELETE", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("updateSettings")
      .addMethod("PUT", new apigw.LambdaIntegration(helloLambda));

      helloApi.root
      .resourceForPath("addRecurring")
      .addMethod("POST", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("updateRecurring")
      .addMethod("PUT", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("deleteRecurring")
      .addMethod("DELETE", new apigw.LambdaIntegration(helloLambda));

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    // Output the API endpoint URL
    new cdk.CfnOutput(this, "ApiUrl", {
      value: helloApi.url,
    });
  }
}
