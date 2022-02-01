import { Stack, StackProps } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaDestinations from "aws-cdk-lib/aws-lambda-destinations";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";

export class LambdaDestinationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =========================================================================
    // Define an EventBridge EventBus
    // =========================================================================
    const eventBus = new events.EventBus(this, "TheDestinedLambdaEventBus", {
      eventBusName: "TheDestinedLambdaEventBus",
    });

    // =========================================================================
    // A new SNS topic. sns topic for the event bus
    // =========================================================================
    const snsTopic = new sns.Topic(this, "TheDestinedLambdaEventBusTopic", {
      topicName: "TheDestinedLambdaEventBusTopic",
      displayName: "TheDestinedLambdaEventBusTopic",
    });

    // =========================================================================
    // lambda function for the destined lambda
    // =========================================================================
    const destinedLambda = new lambda.Function(this, "TheDestinedLambda", {
      functionName: "TheDestinedLambda",
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "destined.handler",
      code: lambda.Code.fromAsset("lambda"),
      retryAttempts: 0,
      onSuccess: new lambdaDestinations.EventBridgeDestination(eventBus),
      onFailure: new lambdaDestinations.EventBridgeDestination(eventBus),
    });

    // =========================================================================
    // Subscribe some endpoint to this topic
    // =========================================================================
    snsTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(destinedLambda) // Use a Lambda function as a subscription target
    );

    // =========================================================================
    // TheSuccessLambda. This lambda is called when the destined lambda succeeds in processing the event
    // =========================================================================
    const successLambda = new lambda.Function(this, "TheSuccessLambda", {
      functionName: "TheSuccessLambda",
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "success.handler",
      code: lambda.Code.fromAsset("lambda"),
      timeout: cdk.Duration.seconds(300),
    });

    // =========================================================================
    // Defines an EventBridge Rule in this stack. The rule will trigger on the success event of the destined lambda and will invoke the success Lambda function
    // =========================================================================
    const successEventRule = new events.Rule(this, "TheSuccessEventRule", {
      eventBus,
      ruleName: "TheSuccessEventRule",
      description: "All success events are caught here and logged centrally",
      eventPattern: {
        detail: {
          requestContext: {
            condition: ["Success"],
          },
          responsePayload: {
            source: ["the-destined-lambda"],
            action: ["message"],
          },
        },
      },
    });

    // =========================================================================
    // Adds a target to the rule. The abstract class RuleTarget can be extended to define new targets.
    // =========================================================================
    successEventRule.addTarget(new eventsTargets.LambdaFunction(successLambda)); // Use an AWS Lambda function as an event rule target

    // =========================================================================
    // failureLambda. This lambda is called when the destined lambda fails to process the event
    // =========================================================================
    const failureLambda = new lambda.Function(this, "TheFailureLambda", {
      functionName: "TheFailureLambda",
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: "failure.handler",
      code: lambda.Code.fromAsset("lambda"),
    });

    // =========================================================================
    // Defines an EventBridge Rule in this stack. The rule will trigger on the failure event of the destined lambda and will invoke the failure Lambda function
    // =========================================================================
    const failureEventRule = new events.Rule(this, "TheFailureEventRule", {
      eventBus,
      ruleName: "TheFailureEventRule",
      description: "All failure events are caught here and logged centrally",
      eventPattern: {
        detail: {
          responsePayload: {
            errorType: ["Error"],
          },
        },
      },
    });

    // =========================================================================
    // Adds a target to the rule. The abstract class RuleTarget can be extended to define new targets.
    // =========================================================================
    failureEventRule.addTarget(new eventsTargets.LambdaFunction(failureLambda)); // Use an AWS Lambda function as an event rule target

    // =========================================================================
    // apiGateway. This is the API Gateway that will be exposed to the outside world
    // =========================================================================
    const apiGatewayRestApi = new apigateway.RestApi(
      this,
      "TheDestinedApiGateway",
      {
        restApiName: "TheDestinedApiGateway",
        deployOptions: {
          // Options for the API Gateway stage that will always point to the latest deployment when deploy is enabled.
          stageName: "prod",
          metricsEnabled: true,
          dataTraceEnabled: true,
          loggingLevel: apigateway.MethodLoggingLevel.INFO,
        },
      }
    );

    // =========================================================================
    // apiGateway iamRole. This is the role that will be used to invoke the API Gateway
    // =========================================================================
    const apiGatewayIamRole = new iam.Role(
      this,
      "TheDestinedApiGatewayIamRole",
      {
        assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      }
    );

    // =========================================================================
    // snsTopic for the apiGateway. This is the topic that will be used to send the event to the destined lambda
    // =========================================================================
    snsTopic.grantPublish(apiGatewayIamRole);

    // =========================================================================
    // responseModel. This is the response model that will be used by the API Gateway. This is the response that will be sent to the client when the destined lambda succeeds
    // =========================================================================
    const responseModel = apiGatewayRestApi.addModel(
      "TheDestinedResponseModel",
      {
        contentType: "application/json",
        modelName: "TheDestinedResponseModel",
        schema: {
          schema: apigateway.JsonSchemaVersion.DRAFT4,
          title: "TheDestinedResponseModel",
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            message: {
              type: apigateway.JsonSchemaType.STRING,
            },
          },
        },
      }
    );

    // =========================================================================
    // errorResponseModel. This is the response model that will be used by the API Gateway. This is the response that will be sent to the client when the destined lambda fails
    // =========================================================================
    const errorResponseModel = apiGatewayRestApi.addModel(
      "TheDestinedErrorResponseModel",
      {
        contentType: "application/json",
        modelName: "TheDestinedErrorResponseModel",
        schema: {
          schema: apigateway.JsonSchemaVersion.DRAFT4,
          title: "TheDestinedErrorResponseModel",
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            message: {
              type: apigateway.JsonSchemaType.STRING,
            },
            state: {
              type: apigateway.JsonSchemaType.STRING,
            },
          },
        },
      }
    );

    // =========================================================================
    // apiGateway root addResource. This is the root resource of the API Gateway
    // =========================================================================
    apiGatewayRestApi.root.addResource("SendEvent").addMethod(
      "GET",
      new apigateway.Integration({
        type: apigateway.IntegrationType.AWS, //native aws integration
        integrationHttpMethod: "POST",
        uri: "arn:aws:apigateway:us-east-1:sns:path//", // This is how we setup an SNS Topic publish operation.
        options: {
          credentialsRole: apiGatewayIamRole,
          requestParameters: {
            "integration.request.header.Content-Type":
              "'application/x-www-form-urlencoded'", // Tell api gw to send our payload as query params
          },
          requestTemplates: {
            // This is the VTL to transform our incoming request to post to our SNS topic
            // Check: https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
            "application/json":
              "Action=Publish&" +
              "TargetArn=$util.urlEncode('" +
              snsTopic.topicArn +
              "')&" +
              "Message=please $input.params().querystring.get('mode')&" +
              "Version=2010-03-31",
          },
          passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
          integrationResponses: [
            {
              // Tells APIGW which response to use based on the returned code from the service
              statusCode: "200",
              responseTemplates: {
                // Just respond with a generic message
                // Check https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html
                "application/json": JSON.stringify({
                  message: "Message added to SNS topic",
                }),
              },
            },
            {
              // For errors, we check if the response contains the words BadRequest
              selectionPattern: "^[Error].*",
              statusCode: "400",
              responseTemplates: {
                "application/json": JSON.stringify({
                  state: "error",
                  message:
                    "$util.escapeJavaScript($input.path('$.errorMessage'))",
                }),
              },
              responseParameters: {
                "method.response.header.Content-Type": "'application/json'",
                "method.response.header.Access-Control-Allow-Origin": "'*'",
                "method.response.header.Access-Control-Allow-Credentials":
                  "'true'",
              },
            },
          ],
        },
      }),
      {
        methodResponses: [
          //We need to define what models are allowed on our method response
          {
            // Successful response from the integration
            statusCode: "200",
            // Define what parameters are allowed or not
            responseParameters: {
              "method.response.header.Content-Type": true,
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Credentials": true,
            },
            // Validate the schema on the response
            responseModels: {
              "application/json": responseModel,
            },
          },
          {
            // Same thing for the error responses
            statusCode: "400",
            responseParameters: {
              "method.response.header.Content-Type": true,
              "method.response.header.Access-Control-Allow-Origin": true,
              "method.response.header.Access-Control-Allow-Credentials": true,
            },
            responseModels: {
              "application/json": errorResponseModel,
            },
          },
        ],
      }
    );
  }
}
