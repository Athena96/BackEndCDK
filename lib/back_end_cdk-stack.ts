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
    const recurringTable = new dynamodb.Table(this, 'Recurring', {
      tableName: 'Recurring',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // Change as per your needs
    });
    
    recurringTable.addGlobalSecondaryIndex({
      indexName: 'UserEmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING }
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
      role: lambdaRole,
      environment: {
        RECURRING_TABLE_NAME: recurringTable.tableName,
      },
    });

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
      .resourceForPath("router")
      .addMethod("POST", new apigw.LambdaIntegration(helloLambda));

    helloApi.root
      .resourceForPath("recurring")
      .addMethod("GET", new apigw.LambdaIntegration(helloLambda));


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
