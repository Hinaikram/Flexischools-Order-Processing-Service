#!/bin/bash
set -e

# Flexischools Order-Processing Service Deployment Script
# This script handles the deployment of the infrastructure and microservice

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_message $BLUE "Checking prerequisites..."
    
    # Check if required tools are installed
    if ! command_exists aws; then
        print_message $RED "Error: AWS CLI is not installed"
        exit 1
    fi
    
    if ! command_exists node; then
        print_message $RED "Error: Node.js is not installed"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_message $RED "Error: npm is not installed"
        exit 1
    fi
    
    if ! command_exists cdk; then
        print_message $RED "Error: AWS CDK is not installed"
        print_message $YELLOW "Installing AWS CDK..."
        npm install -g aws-cdk
    fi
    
    print_message $GREEN "Prerequisites check completed"
}

# Function to validate environment variables
validate_environment() {
    print_message $BLUE "Validating environment variables..."
    
    required_vars=("ENVIRONMENT" "APP_NAME" "AWS_REGION" "AWS_ACCOUNT_ID")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_message $RED "Error: $var environment variable is not set"
            exit 1
        fi
    done
    
    print_message $GREEN "Environment variables validation completed"
}

# Function to setup AWS credentials
setup_aws_credentials() {
    print_message $BLUE "Setting up AWS credentials..."
    
    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_message $RED "Error: AWS credentials are not configured"
        exit 1
    fi
    
    # Verify account ID
    CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    if [ "$CURRENT_ACCOUNT" != "$AWS_ACCOUNT_ID" ]; then
        print_message $RED "Error: Current AWS account ($CURRENT_ACCOUNT) does not match expected account ($AWS_ACCOUNT_ID)"
        exit 1
    fi
    
    print_message $GREEN "AWS credentials setup completed"
}

# Function to run database migrations
run_database_migrations() {
    print_message $BLUE "Running database migrations..."
    
    # Check if database directory exists
    if [ ! -d "database" ]; then
        print_message $YELLOW "Warning: Database directory not found, skipping migrations"
        return
    fi
    
    cd database
    
    # Make migration script executable
    chmod +x run-migrations.sh
    
    # Run migrations
    ./run-migrations.sh $ENVIRONMENT
    
    cd ..
    
    print_message $GREEN "Database migrations completed"
}

# Function to deploy infrastructure
deploy_infrastructure() {
    print_message $BLUE "Deploying infrastructure..."
    
    cd infrastructure
    
    # Install dependencies
    print_message $YELLOW "Installing dependencies..."
    npm install
    
    # Run tests
    print_message $YELLOW "Running tests..."
    npm test
    
    # Build the project
    print_message $YELLOW "Building project..."
    npm run build
    
    # Bootstrap CDK (only if not already done)
    print_message $YELLOW "Bootstrapping CDK..."
    cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION --context environment=$ENVIRONMENT
    
    # Synthesize CloudFormation template
    print_message $YELLOW "Synthesizing CloudFormation template..."
    cdk synth --context environment=$ENVIRONMENT
    
    # Deploy the stack
    print_message $YELLOW "Deploying CDK stack..."
    cdk deploy --require-approval never --context environment=$ENVIRONMENT
    
    cd ..
    
    print_message $GREEN "Infrastructure deployment completed"
}

# Function to build and deploy microservice
deploy_microservice() {
    print_message $BLUE "Building and deploying microservice..."
    
    # Check if microservice directory exists
    if [ ! -d "microservice" ]; then
        print_message $YELLOW "Warning: Microservice directory not found, skipping microservice deployment"
        return
    fi
    
    cd microservice
    
    # Install dependencies
    print_message $YELLOW "Installing dependencies..."
    npm install
    
    # Run tests
    print_message $YELLOW "Running tests..."
    npm test
    
    # Build the project
    print_message $YELLOW "Building project..."
    npm run build
    
    # Get ECR repository URI
    REPOSITORY_URI=$(aws ecr describe-repositories --repository-names $APP_NAME --query 'repositories[0].repositoryUri' --output text --region $AWS_REGION 2>/dev/null || echo "")
    
    if [ -z "$REPOSITORY_URI" ]; then
        print_message $YELLOW "Creating ECR repository..."
        aws ecr create-repository --repository-name $APP_NAME --region $AWS_REGION
        REPOSITORY_URI=$(aws ecr describe-repositories --repository-names $APP_NAME --query 'repositories[0].repositoryUri' --output text --region $AWS_REGION)
    fi
    
    # Login to ECR
    print_message $YELLOW "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI
    
    # Build Docker image
    print_message $YELLOW "Building Docker image..."
    docker build -t $APP_NAME:$ENVIRONMENT .
    
    # Tag and push image
    print_message $YELLOW "Tagging and pushing Docker image..."
    docker tag $APP_NAME:$ENVIRONMENT $REPOSITORY_URI:$ENVIRONMENT
    docker tag $APP_NAME:$ENVIRONMENT $REPOSITORY_URI:latest
    docker push $REPOSITORY_URI:$ENVIRONMENT
    docker push $REPOSITORY_URI:latest
    
    # Update ECS service
    print_message $YELLOW "Updating ECS service..."
    CLUSTER_NAME="$APP_NAME-cluster-$ENVIRONMENT"
    SERVICE_NAME="$APP_NAME-service-$ENVIRONMENT"
    
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $AWS_REGION
    
    # Wait for service to stabilize
    print_message $YELLOW "Waiting for service to stabilize..."
    aws ecs wait services-stable \
        --cluster $CLUSTER_NAME \
        --services $SERVICE_NAME \
        --region $AWS_REGION
    
    cd ..
    
    print_message $GREEN "Microservice deployment completed"
}

# Function to run post-deployment checks
run_post_deployment_checks() {
    print_message $BLUE "Running post-deployment checks..."
    
    # Get load balancer DNS
    STACK_NAME="FlexischoolsStack-$ENVIRONMENT"
    LB_DNS=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $AWS_REGION)
    
    if [ -z "$LB_DNS" ]; then
        print_message $YELLOW "Warning: Could not retrieve load balancer DNS"
        return
    fi
    
    # Wait for load balancer to be available
    print_message $YELLOW "Waiting for load balancer to be available..."
    sleep 60
    
    # Health check
    print_message $YELLOW "Performing health check..."
    HEALTH_ENDPOINT="http://$LB_DNS/health"
    
    for i in {1..10}; do
        if curl -f "$HEALTH_ENDPOINT" >/dev/null 2>&1; then
            print_message $GREEN "Health check passed!"
            break
        fi
        
        if [ $i -eq 10 ]; then
            print_message $RED "Health check failed after 10 attempts"
            exit 1
        fi
        
        print_message $YELLOW "Health check attempt $i failed, retrying in 30 seconds..."
        sleep 30
    done
    
    print_message $GREEN "Post-deployment checks completed"
}

# Function to cleanup
cleanup() {
    print_message $BLUE "Cleaning up..."
    
    # Remove temporary files
    rm -f /tmp/deploy-*.log
    
    # Logout from Docker registries
    docker logout >/dev/null 2>&1 || true
    
    print_message $GREEN "Cleanup completed"
}

# Main deployment function
main() {
    print_message $GREEN "Starting Flexischools Order-Processing Service deployment..."
    print_message $BLUE "Environment: $ENVIRONMENT"
    print_message $BLUE "App Name: $APP_NAME"
    print_message $BLUE "AWS Region: $AWS_REGION"
    print_message $BLUE "AWS Account: $AWS_ACCOUNT_ID"
    
    # Set up error handling
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    setup_aws_credentials
    run_database_migrations
    deploy_infrastructure
    deploy_microservice
    run_post_deployment_checks
    
    print_message $GREEN "Deployment completed successfully!"
    print_message $BLUE "Load Balancer DNS: $LB_DNS"
}

# Script usage
usage() {
    echo "Usage: $0"
    echo "Required environment variables:"
    echo "  ENVIRONMENT    - deployment environment (development|staging|production)"
    echo "  APP_NAME       - application name"
    echo "  AWS_REGION     - AWS region"
    echo "  AWS_ACCOUNT_ID - AWS account ID"
    echo ""
    echo "Optional environment variables:"
    echo "  SKIP_TESTS     - skip running tests (true|false)"
    echo "  FORCE_DEPLOY   - force deployment even if no changes (true|false)"
}

# Check if help is requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main "$@"
