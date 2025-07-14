# Deployment Guide for Flexischools Order-Processing Service

## 🚀 Cloning and Setting Up Your Repository

### Step 1: Create Your Git Repository

1. **Create a new repository on GitHub/GitLab/Bitbucket:**
   - Name: `flexischools-order-processing`
   - Description: "AWS serverless order-processing service for Flexischools"
   - Initialize with README: No (we have our own)

2. **Copy the repository URL for later use**

### Step 2: Download Project Files

Since this is a Replit project, you'll need to download the files. Here are the key files you need:

**Core Application Files:**
- `package.json` - Dependencies and scripts
- `database-server.js` - Main database-enabled server
- `basic-server.js` - Basic HTTP server implementation
- `drizzle.config.js` - Database configuration
- `.gitignore` - Git ignore patterns

**Database & Schema:**
- `shared/schema.ts` - Database schema definitions
- `server/db.ts` - Database connection
- `server/storage.ts` - Data access layer

**Infrastructure:**
- `infrastructure/` - Complete AWS CDK stack
- `ci-cd/` - Azure DevOps pipeline configuration
- `docs/` - Comprehensive documentation

**Database Setup:**
- `database/migrations/` - Migration scripts
- `database/seeds/` - Sample data

### Step 3: Set Up Local Development

1. **Clone your new repository:**
```bash
git clone <your-repo-url>
cd flexischools-order-processing
```

2. **Copy all project files to your local directory**

3. **Install dependencies:**
```bash
npm install
```

4. **Set up environment variables:**
Create a `.env` file in the root directory:
```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database
PGHOST=your-postgres-host
PGPORT=5432
PGDATABASE=your-database-name
PGUSER=your-username
PGPASSWORD=your-password

# Application Configuration
NODE_ENV=development
PORT=5000
```

5. **Set up your PostgreSQL database:**
```bash
# If you don't have a database yet, you can use:
# - Local PostgreSQL installation
# - Docker container
# - Cloud services (AWS RDS, Neon, Supabase)

# Create database schema
npx drizzle-kit push
```

6. **Start the development server:**
```bash
node database-server.js
```

### Step 4: Test Your Setup

Test all endpoints to ensure everything works:

```bash
# Health check
curl http://localhost:5000/health

# Menu items
curl http://localhost:5000/menu

# Orders
curl http://localhost:5000/orders

# Metrics
curl http://localhost:5000/metrics
```

### Step 5: Commit and Push

```bash
git add .
git commit -m "Initial commit: Flexischools order-processing service"
git push origin main
```

## 🏗️ Production Deployment Options

### Option 1: AWS Deployment (Recommended)

1. **Install AWS CLI and CDK:**
```bash
npm install -g aws-cdk
aws configure
```

2. **Deploy infrastructure:**
```bash
cd infrastructure
npm install
cdk bootstrap
cdk deploy
```

3. **Set up environment variables in AWS:**
- Use AWS Secrets Manager for sensitive data
- Configure environment variables in ECS task definition

### Option 2: Other Cloud Providers

**Heroku:**
```bash
heroku create flexischools-orders
heroku addons:create heroku-postgresql
heroku config:set NODE_ENV=production
git push heroku main
```

**Railway:**
```bash
railway login
railway new flexischools-orders
railway add postgresql
railway up
```

**Render:**
- Connect your GitHub repository
- Add PostgreSQL database
- Set environment variables
- Deploy

### Option 3: Docker Deployment

Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 5000

CMD ["node", "database-server.js"]
```

Build and run:
```bash
docker build -t flexischools-orders .
docker run -p 5000:5000 --env-file .env flexischools-orders
```

## 🔧 Configuration for Different Environments

### Development
```bash
NODE_ENV=development
PORT=5000
# Local PostgreSQL connection
DATABASE_URL=postgresql://localhost:5432/flexischools_dev
```

### Staging
```bash
NODE_ENV=staging
PORT=5000
# Staging database connection
DATABASE_URL=postgresql://staging-host:5432/flexischools_staging
```

### Production
```bash
NODE_ENV=production
PORT=5000
# Production database connection (use secrets manager)
DATABASE_URL=postgresql://prod-host:5432/flexischools_prod
```

## 📊 Monitoring Setup

### Health Check Configuration

For load balancers, configure:
- Health check path: `/health`
- Ready check path: `/ready`
- Interval: 30 seconds
- Timeout: 10 seconds

### Logging

The application includes structured logging. For production:
- Set up log aggregation (AWS CloudWatch, ELK stack, etc.)
- Configure log levels appropriately
- Set up alerts for error rates

## 🔐 Security Checklist

- [ ] Database credentials stored securely (not in code)
- [ ] Environment variables properly configured
- [ ] CORS settings appropriate for your domains
- [ ] Rate limiting configured
- [ ] Input validation in place
- [ ] HTTPS enforced in production
- [ ] Database connection encrypted

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Errors:**
   - Verify DATABASE_URL format
   - Check network connectivity
   - Ensure database exists

2. **Missing Dependencies:**
   - Run `npm install` to install all packages
   - Check Node.js version compatibility

3. **Port Conflicts:**
   - Change PORT environment variable
   - Check if port 5000 is available

4. **Schema Errors:**
   - Run `npx drizzle-kit push` to update schema
   - Check database permissions

### Getting Help

- Check the [docs/](docs/) directory for detailed documentation
- Review error logs in the console
- Verify environment variables are set correctly
- Test database connectivity separately

## 📚 Next Steps

After successful deployment:

1. **Set up CI/CD pipeline** using the provided Azure DevOps configuration
2. **Configure monitoring** and alerting
3. **Set up backup strategy** for your database
4. **Review security settings** for production
5. **Scale configuration** based on expected load

## 🤝 Contributing

When working with your team:

1. Use feature branches for new development
2. Run tests before submitting PRs
3. Update documentation for new features
4. Follow the existing code style
5. Add tests for new functionality

This deployment guide should help you get the Flexischools order-processing service running in your own environment!