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
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "destined.handler",
      code: lambda.Code.fromAsset("lambda"),
      retryAttempts: 0,
      onSuccess: new lambdaDestinations.EventBridgeDestination(eventBus),
      onFailure: new lambdaDestinations.EventBridgeDestination(eventBus),
    });
  }
}
