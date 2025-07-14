# Flexischools AWS Serverless Order-Processing Service

## Overview

This is a comprehensive AWS serverless order-processing service for Flexischools, designed to handle school meal orders with high availability, scalability, and security. The system uses modern cloud-native architecture with AWS services including ECS Fargate, RDS PostgreSQL, SQS, and comprehensive monitoring.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture Pattern
- **Serverless-first approach**: Minimizes operational overhead through managed AWS services
- **Event-driven design**: Asynchronous processing using Amazon SQS for order queuing
- **Containerized microservices**: ECS Fargate for serverless container hosting
- **Multi-tier networking**: VPC with public, private, and isolated subnets across multiple AZs

### High-Level Components
1. **Application Load Balancer** → Routes traffic to ECS Fargate containers
2. **ECS Fargate Service** → Runs the Node.js/Express order processing microservice
3. **Amazon RDS PostgreSQL** → Persistent storage for order data
4. **Amazon SQS** → Message queue for asynchronous order processing
5. **AWS Secrets Manager** → Secure credential storage
6. **CloudWatch** → Monitoring, logging, and alerting

## Key Components

### Infrastructure (AWS CDK)
- **Technology Stack**: TypeScript, AWS CDK v2
- **Deployment**: Infrastructure as Code using CDK constructs
- **Environment Management**: Multi-environment support (dev, staging, prod)
- **Security**: IAM roles with least privilege, encrypted storage, network isolation

### Microservice Application
- **Runtime**: Node.js with Express.js framework
- **Database**: PostgreSQL with connection pooling (@neondatabase/serverless)
- **ORM**: Drizzle ORM for type-safe database operations
- **Security Middleware**: Helmet, CORS, rate limiting
- **Logging**: Winston for structured logging
- **Message Processing**: AWS SDK v3 for SQS operations

### Database Schema (PostgreSQL)
- **Users Table**: Student information with username, email, name, grade, school
- **Menu Items Table**: Available food items with pricing, categories, nutrition info, allergens
- **Orders Table**: Order records with student_id, total_amount, delivery_date, status, payment_status
- **Order Items Table**: Junction table linking orders to menu items with quantities and pricing
- **Inventory Table**: Stock tracking for menu items with availability and restock dates
- **Status Flow**: pending → processing → completed/cancelled/failed

## Data Flow

### Order Processing Flow
1. **API Request** → Load balancer receives order submission
2. **Validation** → Express middleware validates and sanitizes input
3. **Queue Message** → Order details sent to SQS queue
4. **Async Processing** → Order processor polls SQS for new messages
5. **Database Storage** → Order persisted to PostgreSQL
6. **Status Updates** → Order status updated throughout lifecycle
7. **Cleanup** → Processed messages deleted from SQS

### Security Flow
- Database credentials retrieved from AWS Secrets Manager
- All traffic encrypted in transit (HTTPS/TLS)
- Database encryption at rest enabled
- VPC network isolation with security groups

## External Dependencies

### AWS Services
- **ECS Fargate**: Container orchestration and hosting
- **RDS PostgreSQL**: Managed database service
- **Application Load Balancer**: Traffic distribution
- **SQS**: Message queuing service
- **Secrets Manager**: Credential management
- **CloudWatch**: Monitoring and logging
- **VPC**: Network isolation and security

### Third-Party Libraries
- **@neondatabase/serverless**: PostgreSQL client optimized for serverless environments
- **drizzle-orm**: Type-safe ORM for PostgreSQL operations
- **drizzle-kit**: Database migration and schema management
- **ws**: WebSocket library for database connections
- **winston**: Logging library
- **helmet**: Security middleware
- **express-rate-limit**: Rate limiting
- **compression**: Response compression

## Deployment Strategy

### Infrastructure Deployment
- **AWS CDK**: TypeScript-based infrastructure as code
- **Multi-Environment**: Separate stacks for dev/staging/prod
- **Configuration**: Environment-specific settings via CDK context
- **Validation**: CDK unit tests for infrastructure components

### Application Deployment
- **Container Strategy**: Docker containerization for ECS Fargate
- **Environment Variables**: Configuration through environment variables
- **Health Checks**: Built-in health endpoints for load balancer
- **Scaling**: Auto-scaling based on CPU/memory utilization

### CI/CD Pipeline
- **Azure DevOps**: Comprehensive pipeline for build, test, and deployment
- **Multi-Stage**: Separate stages for different environments
- **Security Scanning**: Built-in security and vulnerability scanning
- **Database Migrations**: Safe migration handling with rollback capabilities

### Monitoring and Observability
- **CloudWatch Metrics**: System and application metrics
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Alerting**: SNS notifications for critical events
- **Dashboards**: Real-time monitoring of system health

### Key Architectural Decisions

1. **ECS Fargate over Lambda**: Chosen for long-running processes and better control over the runtime environment
2. **PostgreSQL over DynamoDB**: Relational data model better suits order management with complex relationships
3. **SQS for Async Processing**: Decouples order submission from processing for better scalability
4. **Multi-AZ Deployment**: High availability across multiple availability zones
5. **Secrets Manager**: Centralized credential management for enhanced security