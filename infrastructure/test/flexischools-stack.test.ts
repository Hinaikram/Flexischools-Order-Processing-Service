import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { FlexischoolsStack } from '../lib/flexischools-stack';

describe('FlexischoolsStack', () => {
  let template: Template;

  beforeEach(() => {
    const app = new cdk.App();
    const stack = new FlexischoolsStack(app, 'TestStack', {
      environment: 'test',
      appName: 'test-app',
      env: {
        account: '123456789012',
        region: 'us-east-1',
      },
    });
    template = Template.fromStack(stack);
  });

  test('VPC is created with correct configuration', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16',
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
    });
  });

  test('RDS PostgreSQL instance is created', () => {
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      EngineVersion: '15.4',
      DBInstanceClass: 'db.t3.micro',
      StorageEncrypted: true,
      DatabaseName: 'flexischools_orders',
    });
  });

  test('ECS Cluster is created', () => {
    template.hasResourceProperties('AWS::ECS::Cluster', {
      ClusterName: 'test-app-cluster-test',
      ClusterSettings: [
        {
          Name: 'containerInsights',
          Value: 'enabled',
        },
      ],
    });
  });

  test('ECS Service is created with correct configuration', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      ServiceName: 'test-app-service-test',
      LaunchType: 'FARGATE',
      DesiredCount: 1,
    });
  });

  test('Application Load Balancer is created', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      Type: 'application',
      Scheme: 'internet-facing',
    });
  });

  test('SQS Queue is created', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'test-app-order-processing-test',
      VisibilityTimeoutSeconds: 300,
      MessageRetentionPeriod: 345600,
    });
  });

  test('Dead Letter Queue is created', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'test-app-order-processing-dlq-test',
      MessageRetentionPeriod: 1209600,
    });
  });

  test('Security groups are created with correct rules', () => {
    // Database security group
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for RDS PostgreSQL instance',
    });

    // Fargate security group
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for ECS Fargate tasks',
    });

    // ALB security group
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: 'Security group for Application Load Balancer',
    });
  });

  test('Secrets Manager secret is created', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Description: 'Database credentials for Flexischools order-processing service',
      GenerateSecretString: {
        SecretStringTemplate: JSON.stringify({ username: 'flexischools_admin' }),
        GenerateStringKey: 'password',
        ExcludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        PasswordLength: 32,
      },
    });
  });

  test('CloudWatch Log Group is created', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/ecs/test-app-test',
      RetentionInDays: 7,
    });
  });

  test('IAM roles are created with correct permissions', () => {
    // Task role
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
    });

    // Execution role
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      ManagedPolicyArns: [
        'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
      ],
    });
  });

  test('Auto Scaling Target is created', () => {
    template.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', {
      ServiceNamespace: 'ecs',
      ResourceId: Match.stringLikeRegexp('service/test-app-cluster-test/.*'),
      ScalableDimension: 'ecs:service:DesiredCount',
      MinCapacity: 1,
      MaxCapacity: 5,
    });
  });

  test('CloudWatch Dashboard is created', () => {
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'test-app-test-dashboard',
    });
  });

  test('SNS Topic for alerts is created', () => {
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'test-app-alerts-test',
      DisplayName: 'Flexischools Order Processing Alerts',
    });
  });

  test('CloudWatch Alarms are created', () => {
    // CPU alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmDescription: 'High CPU utilization on Fargate service',
      Threshold: 80,
      EvaluationPeriods: 2,
    });

    // Memory alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmDescription: 'High memory utilization on Fargate service',
      Threshold: 90,
      EvaluationPeriods: 2,
    });

    // Database connection alarm
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmDescription: 'High database connection count',
      Threshold: 80,
      EvaluationPeriods: 2,
    });
  });

  test('Outputs are created', () => {
    template.hasOutput('LoadBalancerDNS', {
      Description: 'DNS name of the load balancer',
    });

    template.hasOutput('DatabaseEndpoint', {
      Description: 'RDS PostgreSQL endpoint',
    });

    template.hasOutput('DatabaseSecretArn', {
      Description: 'ARN of the database credentials secret',
    });

    template.hasOutput('OrderQueueUrl', {
      Description: 'URL of the order processing SQS queue',
    });

    template.hasOutput('ClusterName', {
      Description: 'Name of the ECS cluster',
    });

    template.hasOutput('VpcId', {
      Description: 'ID of the VPC',
    });
  });
});
