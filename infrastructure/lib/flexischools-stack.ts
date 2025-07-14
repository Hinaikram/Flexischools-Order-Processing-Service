import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface FlexischoolsStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
}

export class FlexischoolsStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: ecs.Cluster;
  public readonly database: rds.DatabaseInstance;
  public readonly orderQueue: sqs.Queue;
  public readonly fargateService: ecs_patterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: FlexischoolsStackProps) {
    super(scope, id, props);

    const { environment, appName } = props;

    // Create VPC with multi-AZ setup for high availability
    this.vpc = new ec2.Vpc(this, 'FlexischoolsVpc', {
      maxAzs: 3,
      natGateways: 2, // Multi-AZ NAT gateways for high availability
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create security groups
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: false,
    });

    const fargateSecurityGroup = new ec2.SecurityGroup(this, 'FargateSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ECS Fargate tasks',
      allowAllOutbound: true,
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });

    // Configure security group rules
    dbSecurityGroup.addIngressRule(
      fargateSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Fargate tasks to connect to PostgreSQL'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic'
    );

    // Create database credentials secret
    const dbCredentials = new secretsmanager.Secret(this, 'DbCredentials', {
      description: 'Database credentials for Flexischools order-processing service',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'flexischools_admin' }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        passwordLength: 32,
      },
    });

    // Create database subnet group
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DbSubnetGroup', {
      vpc: this.vpc,
      description: 'Subnet group for RDS PostgreSQL',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Create database parameter group
    const dbParameterGroup = new rds.ParameterGroup(this, 'DbParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      description: 'Parameter group for Flexischools PostgreSQL',
      parameters: {
        'shared_preload_libraries': 'pg_stat_statements',
        'log_statement': 'all',
        'log_duration': '1',
        'log_min_duration_statement': '1000',
        'max_connections': '100',
        'work_mem': '4MB',
        'maintenance_work_mem': '64MB',
      },
    });

    // Create RDS PostgreSQL instance
    this.database = new rds.DatabaseInstance(this, 'FlexischoolsDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: ec2.InstanceType.of(
        environment === 'production' ? ec2.InstanceClass.T3 : ec2.InstanceClass.T3,
        environment === 'production' ? ec2.InstanceSize.SMALL : ec2.InstanceSize.MICRO
      ),
      vpc: this.vpc,
      subnetGroup: dbSubnetGroup,
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'flexischools_orders',
      storageEncrypted: true,
      multiAz: environment === 'production',
      allocatedStorage: environment === 'production' ? 100 : 20,
      maxAllocatedStorage: environment === 'production' ? 1000 : 100,
      storageType: rds.StorageType.GP3,
      backupRetention: cdk.Duration.days(environment === 'production' ? 30 : 7),
      deletionProtection: environment === 'production',
      deleteAutomatedBackups: environment !== 'production',
      parameterGroup: dbParameterGroup,
      performanceInsightRetention: environment === 'production' ? 
        rds.PerformanceInsightRetention.LONG_TERM : 
        rds.PerformanceInsightRetention.DEFAULT,
      enablePerformanceInsights: true,
      removalPolicy: environment === 'production' ? 
        cdk.RemovalPolicy.SNAPSHOT : 
        cdk.RemovalPolicy.DESTROY,
    });

    // Create SQS queue for order processing
    const deadLetterQueue = new sqs.Queue(this, 'OrderProcessingDLQ', {
      queueName: `${appName}-order-processing-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.orderQueue = new sqs.Queue(this, 'OrderProcessingQueue', {
      queueName: `${appName}-order-processing-${environment}`,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'FlexischoolsCluster', {
      vpc: this.vpc,
      clusterName: `${appName}-cluster-${environment}`,
      containerInsights: true,
    });

    // Create CloudWatch Log Group
    const logGroup = new logs.LogGroup(this, 'FlexischoolsLogGroup', {
      logGroupName: `/aws/ecs/${appName}-${environment}`,
      retention: environment === 'production' ? 
        logs.RetentionDays.ONE_MONTH : 
        logs.RetentionDays.ONE_WEEK,
      removalPolicy: environment === 'production' ? 
        cdk.RemovalPolicy.RETAIN : 
        cdk.RemovalPolicy.DESTROY,
    });

    // Create IAM role for ECS tasks
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'IAM role for Flexischools ECS tasks',
    });

    // Create IAM role for ECS task execution
    const executionRole = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
      description: 'IAM role for ECS task execution',
    });

    // Grant permissions to task role
    dbCredentials.grantRead(taskRole);
    this.orderQueue.grantConsumeMessages(taskRole);
    this.orderQueue.grantSendMessages(taskRole);

    // Grant permissions to execution role
    dbCredentials.grantRead(executionRole);
    logGroup.grantWrite(executionRole);

    // Create Fargate service with Application Load Balancer
    this.fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'OrderProcessingService', {
      cluster: this.cluster,
      serviceName: `${appName}-service-${environment}`,
      cpu: environment === 'production' ? 1024 : 512,
      memoryLimitMiB: environment === 'production' ? 2048 : 1024,
      desiredCount: environment === 'production' ? 3 : 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromRegistry('flexischools/order-processor:latest'),
        containerName: 'order-processor',
        containerPort: 3000,
        taskRole,
        executionRole,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'order-processor',
          logGroup,
        }),
        environment: {
          NODE_ENV: environment,
          APP_NAME: appName,
          AWS_REGION: this.region,
          DB_HOST: this.database.instanceEndpoint.hostname,
          DB_PORT: this.database.instanceEndpoint.port.toString(),
          DB_NAME: 'flexischools_orders',
          SQS_QUEUE_URL: this.orderQueue.queueUrl,
        },
        secrets: {
          DB_USERNAME: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
        },
      },
      publicLoadBalancer: true,
      taskSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
    });

    // Configure security groups for the service
    this.fargateService.service.connections.addSecurityGroup(fargateSecurityGroup);
    this.fargateService.loadBalancer.connections.addSecurityGroup(albSecurityGroup);

    // Configure health checks
    this.fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Configure auto scaling
    const scalableTarget = this.fargateService.service.autoScaleTaskCount({
      minCapacity: environment === 'production' ? 2 : 1,
      maxCapacity: environment === 'production' ? 20 : 5,
    });

    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(1),
    });

    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.minutes(5),
      scaleOutCooldown: cdk.Duration.minutes(1),
    });

    // Create SNS topic for alerts
    const alertTopic = new sns.Topic(this, 'AlertTopic', {
      topicName: `${appName}-alerts-${environment}`,
      displayName: 'Flexischools Order Processing Alerts',
    });

    // Add email subscription for alerts (configure email in environment variables)
    const alertEmail = process.env.ALERT_EMAIL || 'admin@flexischools.com';
    alertTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));

    // Create CloudWatch alarms
    new cloudwatch.Alarm(this, 'HighCpuAlarm', {
      metric: this.fargateService.service.metricCpuUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
      alarmDescription: 'High CPU utilization on Fargate service',
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alertTopic));

    new cloudwatch.Alarm(this, 'HighMemoryAlarm', {
      metric: this.fargateService.service.metricMemoryUtilization(),
      threshold: 90,
      evaluationPeriods: 2,
      alarmDescription: 'High memory utilization on Fargate service',
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alertTopic));

    new cloudwatch.Alarm(this, 'DatabaseConnectionAlarm', {
      metric: this.database.metricDatabaseConnections(),
      threshold: 80,
      evaluationPeriods: 2,
      alarmDescription: 'High database connection count',
    }).addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(alertTopic));

    // Create CloudWatch dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'FlexischoolsDashboard', {
      dashboardName: `${appName}-${environment}-dashboard`,
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS Service Metrics',
        left: [
          this.fargateService.service.metricCpuUtilization(),
          this.fargateService.service.metricMemoryUtilization(),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Database Metrics',
        left: [
          this.database.metricCPUUtilization(),
          this.database.metricDatabaseConnections(),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Load Balancer Metrics',
        left: [
          this.fargateService.loadBalancer.metricRequestCount(),
          this.fargateService.loadBalancer.metricTargetResponseTime(),
        ],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'SQS Queue Metrics',
        left: [
          this.orderQueue.metricApproximateNumberOfMessages(),
          this.orderQueue.metricApproximateNumberOfMessagesVisible(),
        ],
        width: 12,
      })
    );

    // Output important values
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.fargateService.loadBalancer.loadBalancerDnsName,
      description: 'DNS name of the load balancer',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: dbCredentials.secretArn,
      description: 'ARN of the database credentials secret',
    });

    new cdk.CfnOutput(this, 'OrderQueueUrl', {
      value: this.orderQueue.queueUrl,
      description: 'URL of the order processing SQS queue',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'Name of the ECS cluster',
    });

    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'ID of the VPC',
    });

    // Add tags to all resources
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Application', appName);
    cdk.Tags.of(this).add('ManagedBy', 'AWS CDK');
  }
}
