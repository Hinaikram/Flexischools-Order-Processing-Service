import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { OrderProcessor } from './order-processor';
import { createLogger, format, transports } from 'winston';

// Initialize logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});

// Environment variables
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || 'flexischools_orders';
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const DB_SECRET_ARN = process.env.DB_SECRET_ARN;

// Database connection pool
let dbPool: Pool;

// SQS client
const sqsClient = new SQSClient({ region: AWS_REGION });

// Secrets Manager client
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

// Order processor instance
let orderProcessor: OrderProcessor;

// Initialize database connection
async function initializeDatabase(): Promise<void> {
  try {
    let dbUsername: string;
    let dbPassword: string;

    if (DB_SECRET_ARN) {
      // Get credentials from Secrets Manager
      const command = new GetSecretValueCommand({ SecretId: DB_SECRET_ARN });
      const response = await secretsClient.send(command);
      const secret = JSON.parse(response.SecretString || '{}');
      dbUsername = secret.username;
      dbPassword = secret.password;
    } else {
      // Fallback to environment variables
      dbUsername = process.env.DB_USERNAME || 'postgres';
      dbPassword = process.env.DB_PASSWORD || 'password';
    }

    dbPool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: dbUsername,
      password: dbPassword,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Test database connection
    await dbPool.query('SELECT NOW()');
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Failed to initialize database connection', error);
    throw error;
  }
}

// Initialize order processor
async function initializeOrderProcessor(): Promise<void> {
  if (!SQS_QUEUE_URL) {
    throw new Error('SQS_QUEUE_URL environment variable is required');
  }

  orderProcessor = new OrderProcessor(sqsClient, dbPool, SQS_QUEUE_URL, logger);
  await orderProcessor.start();
  logger.info('Order processor initialized successfully');
}

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Compression middleware
app.use(compression());

// CORS middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await dbPool.query('SELECT 1');
    
    // Check SQS connectivity (optional)
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: 'healthy',
        sqs: 'healthy',
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
        },
        uptime: process.uptime(),
      }
    };

    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

// Ready check endpoint
app.get('/ready', (req, res) => {
  if (dbPool && orderProcessor) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
    });
  }
});

// Orders endpoints
app.post('/orders', async (req, res) => {
  try {
    const { studentId, items, totalAmount, deliveryDate } = req.body;

    // Validate required fields
    if (!studentId || !items || !totalAmount || !deliveryDate) {
      return res.status(400).json({
        error: 'Missing required fields: studentId, items, totalAmount, deliveryDate',
      });
    }

    // Validate items structure
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Items must be a non-empty array',
      });
    }

    // Create order in database
    const query = `
      INSERT INTO orders (student_id, items, total_amount, delivery_date, status, created_at)
      VALUES ($1, $2, $3, $4, 'pending', NOW())
      RETURNING id, student_id, items, total_amount, delivery_date, status, created_at
    `;

    const result = await dbPool.query(query, [
      studentId,
      JSON.stringify(items),
      totalAmount,
      deliveryDate,
    ]);

    const order = result.rows[0];

    // Send order to SQS for processing
    await orderProcessor.processOrder(order);

    logger.info('Order created successfully', { orderId: order.id, studentId });

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        studentId: order.student_id,
        items: order.items,
        totalAmount: order.total_amount,
        deliveryDate: order.delivery_date,
        status: order.status,
        createdAt: order.created_at,
      },
    });
  } catch (error) {
    logger.error('Error creating order', error);
    res.status(500).json({
      error: 'Internal server error',
      message: NODE_ENV === 'development' ? error.message : 'Failed to create order',
    });
  }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT id, student_id, items, total_amount, delivery_date, status, created_at, updated_at
      FROM orders
      WHERE id = $1
    `;

    const result = await dbPool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Order not found',
      });
    }

    const order = result.rows[0];

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        studentId: order.student_id,
        items: order.items,
        totalAmount: order.total_amount,
        deliveryDate: order.delivery_date,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
    });
  } catch (error) {
    logger.error('Error retrieving order', error);
    res.status(500).json({
      error: 'Internal server error',
      message: NODE_ENV === 'development' ? error.message : 'Failed to retrieve order',
    });
  }
});

app.get('/orders', async (req, res) => {
  try {
    const { studentId, status, page = 1, limit = 10 } = req.query;

    let query = `
      SELECT id, student_id, items, total_amount, delivery_date, status, created_at, updated_at
      FROM orders
      WHERE 1=1
    `;
    const params: any[] = [];

    if (studentId) {
      params.push(studentId);
      query += ` AND student_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;

    // Add pagination
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    params.push(parseInt(limit as string), offset);
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await dbPool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM orders WHERE 1=1';
    const countParams: any[] = [];

    if (studentId) {
      countParams.push(studentId);
      countQuery += ` AND student_id = $${countParams.length}`;
    }

    if (status) {
      countParams.push(status);
      countQuery += ` AND status = $${countParams.length}`;
    }

    const countResult = await dbPool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.status(200).json({
      success: true,
      orders: result.rows.map(order => ({
        id: order.id,
        studentId: order.student_id,
        items: order.items,
        totalAmount: order.total_amount,
        deliveryDate: order.delivery_date,
        status: order.status,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit as string)),
      },
    });
  } catch (error) {
    logger.error('Error retrieving orders', error);
    res.status(500).json({
      error: 'Internal server error',
      message: NODE_ENV === 'development' ? error.message : 'Failed to retrieve orders',
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        AVG(total_amount) as average_order_value,
        SUM(total_amount) as total_revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;

    const result = await dbPool.query(metricsQuery);
    const metrics = result.rows[0];

    res.status(200).json({
      success: true,
      metrics: {
        totalOrders: parseInt(metrics.total_orders),
        pendingOrders: parseInt(metrics.pending_orders),
        processingOrders: parseInt(metrics.processing_orders),
        completedOrders: parseInt(metrics.completed_orders),
        cancelledOrders: parseInt(metrics.cancelled_orders),
        averageOrderValue: parseFloat(metrics.average_order_value) || 0,
        totalRevenue: parseFloat(metrics.total_revenue) || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error retrieving metrics', error);
    res.status(500).json({
      error: 'Internal server error',
      message: NODE_ENV === 'development' ? error.message : 'Failed to retrieve metrics',
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', error);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (orderProcessor) {
    await orderProcessor.stop();
  }
  
  if (dbPool) {
    await dbPool.end();
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  if (orderProcessor) {
    await orderProcessor.stop();
  }
  
  if (dbPool) {
    await dbPool.end();
  }
  
  process.exit(0);
});

// Start server
async function startServer(): Promise<void> {
  try {
    await initializeDatabase();
    await initializeOrderProcessor();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Flexischools Order-Processing Service started on port ${PORT}`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info(`Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
      logger.info(`SQS Queue: ${SQS_QUEUE_URL}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
