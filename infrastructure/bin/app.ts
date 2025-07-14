#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FlexischoolsStack } from '../lib/flexischools-stack';

const app = new cdk.App();

// Get environment configuration
const environment = app.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'development';
const appName = app.node.tryGetContext('appName') || process.env.APP_NAME || 'flexischools-order-processor';
const region = app.node.tryGetContext('region') || process.env.AWS_REGION || 'us-east-1';
const account = app.node.tryGetContext('account') || process.env.AWS_ACCOUNT_ID;

// Validate required environment variables
if (!account) {
  throw new Error('AWS_ACCOUNT_ID must be set');
}

// Create stack for the specified environment
new FlexischoolsStack(app, `FlexischoolsStack-${environment}`, {
  env: {
    account,
    region,
  },
  environment,
  appName,
  description: `Flexischools order-processing service infrastructure for ${environment}`,
  tags: {
    Environment: environment,
    Application: appName,
    ManagedBy: 'AWS CDK',
  },
});

// Add metadata
//app.node.setMetadata('version', '1.0.0');
//app.node.setMetadata('description', 'Flexischools AWS serverless order-processing service');
//app.node.setMetadata('author', 'Flexischools Platform Team');
