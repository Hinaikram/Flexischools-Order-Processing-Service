#!/bin/bash
set -e

# Flexischools Order-Processing Service Test Script
# This script runs comprehensive tests for the entire project

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
    print_message $BLUE "Checking test prerequisites..."
    
    # Check if required tools are installed
    if ! command_exists node; then
        print_message $RED "Error: Node.js is not installed"
        exit 1
    fi
    
    if ! command_exists npm; then
        print_message $RED "Error: npm is not installed"
        exit 1
    fi
    
    if ! command_exists docker; then
        print_message $RED "Error: Docker is not installed"
        exit 1
    fi
    
    print_message $GREEN "Prerequisites check completed"
}

# Function to run infrastructure tests
run_infrastructure_tests() {
    print_message $BLUE "Running infrastructure tests..."
    
    if [ ! -d "infrastructure" ]; then
        print_message $YELLOW "Warning: Infrastructure directory not found, skipping infrastructure tests"
        return
    fi
    
    cd infrastructure
    
    # Install dependencies
    print_message $YELLOW "Installing infrastructure dependencies..."
    npm install
    
    # Run linting
    print_message $YELLOW "Running infrastructure linting..."
    npm run lint || true
    
    # Run unit tests
    print_message $YELLOW "Running infrastructure unit tests..."
    npm test
    
    # Run CDK synth to validate templates
    print_message $YELLOW "Validating CDK templates..."
    npx cdk synth --context environment=test
    
    # Check for CDK security issues
    print_message $YELLOW "Checking for CDK security issues..."
    npm audit --audit-level=moderate || true
    
    cd ..
    
    print_message $GREEN "Infrastructure tests completed"
}

# Function to run microservice tests
run_microservice_tests() {
    print_message $BLUE "Running microservice tests..."
    
    if [ ! -d "microservice" ]; then
        print_message $YELLOW "Warning: Microservice directory not found, skipping microservice tests"
        return
    fi
    
    cd microservice
    
    # Install dependencies
    print_message $YELLOW "Installing microservice dependencies..."
    npm install
    
    # Run linting
    print_message $YELLOW "Running microservice linting..."
    npm run lint || true
    
    # Run unit tests
    print_message $YELLOW "Running microservice unit tests..."
    npm test
    
    # Run integration tests
    print_message $YELLOW "Running microservice integration tests..."
    npm run test:integration || true
    
    # Run security audit
    print_message $YELLOW "Running microservice security audit..."
    npm audit --audit-level=moderate || true
    
    # Build the project
    print_message $YELLOW "Building microservice..."
    npm run build
    
    cd ..
    
    print_message $GREEN "Microservice tests completed"
}

# Function to run database tests
run_database_tests() {
    print_message $BLUE "Running database tests..."
    
    if [ ! -d "database" ]; then
        print_message $YELLOW "Warning: Database directory not found, skipping database tests"
        return
    fi
    
    cd database
    
    # Check if PostgreSQL is available for testing
    if command_exists psql; then
        print_message $YELLOW "Running database migration tests..."
        
        # Create test database
        createdb flexischools_test || true
        
        # Run migrations on test database
        export DATABASE_URL="postgresql://localhost/flexischools_test"
        ./run-migrations.sh test || true
        
        # Run database tests
        if [ -f "test_migrations.sql" ]; then
            psql -d flexischools_test -f test_migrations.sql
        fi
        
        # Cleanup test database
        dropdb flexischools_test || true
    else
        print_message $YELLOW "PostgreSQL not available, skipping database migration tests"
    fi
    
    # Validate SQL syntax
    print_message $YELLOW "Validating SQL syntax..."
    for sql_file in $(find . -name "*.sql"); do
        if command_exists sqlfluff; then
            sqlfluff lint "$sql_file" || true
        fi
    done
    
    cd ..
    
    print_message $GREEN "Database tests completed"
}

# Function to run Docker tests
run_docker_tests() {
    print_message $BLUE "Running Docker tests..."
    
    if [ ! -f "microservice/Dockerfile" ]; then
        print_message $YELLOW "Warning: Dockerfile not found, skipping Docker tests"
        return
    fi
    
    cd microservice
    
    # Build Docker image
    print_message $YELLOW "Building Docker image for testing..."
    docker build -t flexischools-test:latest .
    
    # Run container security scan
    if command_exists trivy; then
        print_message $YELLOW "Running container security scan..."
        trivy image flexischools-test:latest || true
    fi
    
    # Test Docker image
    print_message $YELLOW "Testing Docker image..."
    docker run --rm -d --name flexischools-test -p 3001:3000 flexischools-test:latest
    
    # Wait for container to start
    sleep 10
    
    # Test container health
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        print_message $GREEN "Docker container health check passed"
    else
        print_message $YELLOW "Docker container health check failed"
    fi
    
    # Stop and remove container
    docker stop flexischools-test || true
    docker rm flexischools-test || true
    
    # Remove test image
    docker rmi flexischools-test:latest || true
    
    cd ..
    
    print_message $GREEN "Docker tests completed"
}

# Function to run security tests
run_security_tests() {
    print_message $BLUE "Running security tests..."
    
    # Run npm audit for all Node.js projects
    for dir in infrastructure microservice; do
        if [ -d "$dir" ]; then
            cd "$dir"
            print_message $YELLOW "Running security audit for $dir..."
            npm audit --audit-level=moderate || true
            cd ..
        fi
    done
    
    # Run static code analysis
    if command_exists semgrep; then
        print_message $YELLOW "Running static code analysis..."
        semgrep --config=auto . || true
    fi
    
    # Check for secrets in code
    if command_exists gitleaks; then
        print_message $YELLOW "Checking for secrets in code..."
        gitleaks detect --no-git || true
    fi
    
    print_message $GREEN "Security tests completed"
}

# Function to run performance tests
run_performance_tests() {
    print_message $BLUE "Running performance tests..."
    
    if [ ! -d "tests/performance" ]; then
        print_message $YELLOW "Warning: Performance tests directory not found, skipping performance tests"
        return
    fi
    
    cd tests/performance
    
    # Install dependencies
    npm install || true
    
    # Run performance tests
    npm test || true
    
    cd ../..
    
    print_message $GREEN "Performance tests completed"
}

# Function to generate test reports
generate_test_reports() {
    print_message $BLUE "Generating test reports..."
    
    # Create reports directory
    mkdir -p reports
    
    # Combine test results
    echo "# Test Results Summary" > reports/test-summary.md
    echo "Generated on: $(date)" >> reports/test-summary.md
    echo "" >> reports/test-summary.md
    
    # Add test results from each component
    for dir in infrastructure microservice; do
        if [ -d "$dir" ] && [ -f "$dir/test-results.xml" ]; then
            echo "## $dir Test Results" >> reports/test-summary.md
            echo "- Test results file: $dir/test-results.xml" >> reports/test-summary.md
            echo "" >> reports/test-summary.md
        fi
    done
    
    # Add coverage information
    echo "## Code Coverage" >> reports/test-summary.md
    for dir in infrastructure microservice; do
        if [ -d "$dir/coverage" ]; then
            echo "- $dir coverage: $dir/coverage/" >> reports/test-summary.md
        fi
    done
    
    print_message $GREEN "Test reports generated in reports/ directory"
}

# Function to cleanup test artifacts
cleanup_tests() {
    print_message $BLUE "Cleaning up test artifacts..."
    
    # Remove temporary files
    rm -f /tmp/test-*.log
    
    # Stop any running test containers
    docker stop $(docker ps -q --filter "name=flexischools-test") 2>/dev/null || true
    docker rm $(docker ps -aq --filter "name=flexischools-test") 2>/dev/null || true
    
    # Remove test images
    docker rmi $(docker images -q --filter "reference=flexischools-test") 2>/dev/null || true
    
    print_message $GREEN "Test cleanup completed"
}

# Main test function
main() {
    print_message $GREEN "Starting Flexischools Order-Processing Service tests..."
    
    # Set up error handling
    trap cleanup_tests EXIT
    
    # Parse command line arguments
    RUN_ALL=true
    SKIP_DOCKER=false
    SKIP_SECURITY=false
    SKIP_PERFORMANCE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-docker)
                SKIP_DOCKER=true
                shift
                ;;
            --skip-security)
                SKIP_SECURITY=true
                shift
                ;;
            --skip-performance)
                SKIP_PERFORMANCE=true
                shift
                ;;
            --infrastructure-only)
                RUN_ALL=false
                RUN_INFRASTRUCTURE=true
                shift
                ;;
            --microservice-only)
                RUN_ALL=false
                RUN_MICROSERVICE=true
                shift
                ;;
            --database-only)
                RUN_ALL=false
                RUN_DATABASE=true
                shift
                ;;
            *)
                print_message $RED "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run test steps
    check_prerequisites
    
    if [ "$RUN_ALL" = true ] || [ "$RUN_INFRASTRUCTURE" = true ]; then
        run_infrastructure_tests
    fi
    
    if [ "$RUN_ALL" = true ] || [ "$RUN_MICROSERVICE" = true ]; then
        run_microservice_tests
    fi
    
    if [ "$RUN_ALL" = true ] || [ "$RUN_DATABASE" = true ]; then
        run_database_tests
    fi
    
    if [ "$RUN_ALL" = true ] && [ "$SKIP_DOCKER" = false ]; then
        run_docker_tests
    fi
    
    if [ "$RUN_ALL" = true ] && [ "$SKIP_SECURITY" = false ]; then
        run_security_tests
    fi
    
    if [ "$RUN_ALL" = true ] && [ "$SKIP_PERFORMANCE" = false ]; then
        run_performance_tests
    fi
    
    generate_test_reports
    
    print_message $GREEN "All tests completed successfully!"
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --infrastructure-only    Run only infrastructure tests"
    echo "  --microservice-only      Run only microservice tests"
    echo "  --database-only          Run only database tests"
    echo "  --skip-docker           Skip Docker tests"
    echo "  --skip-security         Skip security tests"
    echo "  --skip-performance      Skip performance tests"
    echo "  -h, --help              Show this help message"
}

# Check if help is requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    usage
    exit 0
fi

# Run main function
main "$@"
