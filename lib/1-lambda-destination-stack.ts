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
  }
}
