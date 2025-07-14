// Full CDK stack with RDS, ECS Fargate, SQS, and ALB
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export interface FlexischoolsStackProps extends cdk.StackProps {
    environment: string;
    appName: string;
}

export class FlexischoolsStack extends cdk.Stack {
    public readonly orderQueue: sqs.Queue;

    constructor(scope: Construct, id: string, props: FlexischoolsStackProps) {
        super(scope, id, props);
        const { environment, appName } = props;

        // VPC
        const vpc = new ec2.Vpc(this, 'Vpc', {
            maxAzs: 2,
        });

        // SQS Queues
        const deadLetterQueue = new sqs.Queue(this, 'OrderDLQ', {
            retentionPeriod: cdk.Duration.days(14),
        });

        this.orderQueue = new sqs.Queue(this, 'OrderQueue', {
            visibilityTimeout: cdk.Duration.seconds(300),
            retentionPeriod: cdk.Duration.days(4),
            deadLetterQueue: {
                maxReceiveCount: 3,
                queue: deadLetterQueue,
            },
        });

        // RDS PostgreSQL
        const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
            vpc,
            allowAllOutbound: true,
        });

        const dbInstance = new rds.DatabaseInstance(this, 'PostgresDB', {
            engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_15 }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            vpc,
            securityGroups: [dbSecurityGroup],
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            multiAz: false,
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
            publiclyAccessible: true,
            credentials: rds.Credentials.fromGeneratedSecret('postgres'),
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            deletionProtection: false,
        });

        // ECS Cluster
        const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc });

        // Fargate Task Definition
        const taskRole = new iam.Role(this, 'FargateTaskRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        this.orderQueue.grantConsumeMessages(taskRole);

        const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
            memoryLimitMiB: 512,
            cpu: 256,
            taskRole,
        });

        taskDefinition.addContainer('AppContainer', {
            image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
            logging: ecs.LogDriver.awsLogs({ streamPrefix: 'App' }),
            environment: {
                QUEUE_URL: this.orderQueue.queueUrl,
            },
            portMappings: [
                { containerPort: 80 },
            ],
        });

        // Fargate Service + ALB
        const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'FargateService', {
            cluster,
            taskDefinition,
            publicLoadBalancer: true,
        });

        // CloudWatch Dashboard
        const dashboard = new cloudwatch.Dashboard(this, 'FlexischoolsDashboard', {
            dashboardName: `${appName}-${environment}-dashboard`,
        });

        dashboard.addWidgets(
            new cloudwatch.GraphWidget({
                title: 'SQS Queue Metrics',
                left: [
                    this.orderQueue.metricApproximateNumberOfMessagesVisible(),
                    this.orderQueue.metricApproximateNumberOfMessagesDelayed(),
                    this.orderQueue.metricNumberOfMessagesDeleted(),
                    this.orderQueue.metricNumberOfMessagesReceived(),
                    this.orderQueue.metricNumberOfMessagesSent(),
                    this.orderQueue.metricSentMessageSize(),
                ],
                width: 12,
            })
        );

        // Outputs
        new cdk.CfnOutput(this, 'OrderQueueUrl', {
            value: this.orderQueue.queueUrl,
            description: 'URL of the order processing SQS queue',
        });

        new cdk.CfnOutput(this, 'RDSEndpoint', {
            value: dbInstance.dbInstanceEndpointAddress,
            description: 'RDS endpoint address',
        });

        new cdk.CfnOutput(this, 'ALB DNS', {
            value: fargateService.loadBalancer.loadBalancerDnsName,
            description: 'DNS of the Application Load Balancer',
        });
    }
}
