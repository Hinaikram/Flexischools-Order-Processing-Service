const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const checks = {
    database: 'healthy',
    sqs: 'healthy',
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  };

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    checks,
  });
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// Get orders endpoint
app.get('/orders', (req, res) => {
  const { studentId, status, page = 1, limit = 10 } = req.query;
  
  // Sample orders data
  const mockOrders = [
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440001',
      studentId: '660e8400-e29b-41d4-a716-446655440001',
      items: [
        {
          id: '770e8400-e29b-41d4-a716-446655440001',
          name: 'Chicken Sandwich',
          price: 8.50,
          quantity: 1,
          category: 'main_course'
        },
        {
          id: '770e8400-e29b-41d4-a716-446655440004',
          name: 'Apple Juice',
          price: 3.00,
          quantity: 1,
          category: 'drink'
        }
      ],
      totalAmount: 11.50,
      deliveryDate: '2025-01-16',
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: '2025-01-15T10:30:00Z',
      updatedAt: '2025-01-15T10:30:00Z'
    },
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440002',
      studentId: '660e8400-e29b-41d4-a716-446655440002',
      items: [
        {
          id: '770e8400-e29b-41d4-a716-446655440002',
          name: 'Margherita Pizza Slice',
          price: 6.00,
          quantity: 1,
          category: 'main_course'
        }
      ],
      totalAmount: 6.00,
      deliveryDate: '2025-01-16',
      status: 'completed',
      paymentStatus: 'completed',
      createdAt: '2025-01-15T09:15:00Z',
      updatedAt: '2025-01-15T11:45:00Z'
    }
  ];

  // Filter orders based on query parameters
  let filteredOrders = mockOrders;
  
  if (studentId) {
    filteredOrders = filteredOrders.filter(order => order.studentId === studentId);
  }
  
  if (status) {
    filteredOrders = filteredOrders.filter(order => order.status === status);
  }

  // Pagination
  const totalCount = filteredOrders.length;
  const totalPages = Math.ceil(totalCount / limit);
  const startIndex = (page - 1) * limit;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + Number(limit));

  res.json({
    success: true,
    orders: paginatedOrders,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      totalCount,
      totalPages,
    },
  });
});

// Create order endpoint
app.post('/orders', (req, res) => {
  const { studentId, items, totalAmount, deliveryDate, specialInstructions } = req.body;

  // Validate required fields
  if (!studentId || !items || !totalAmount || !deliveryDate) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Missing required fields: studentId, items, totalAmount, deliveryDate',
      timestamp: new Date().toISOString(),
    });
  }

  // Validate items array
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Items must be a non-empty array',
      timestamp: new Date().toISOString(),
    });
  }

  // Create order
  const order = {
    id: `order_${Date.now()}`,
    studentId,
    items,
    totalAmount,
    deliveryDate,
    specialInstructions,
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log('Order created:', order);

  res.status(201).json({
    success: true,
    order,
  });
});

// Get order details endpoint
app.get('/orders/details', (req, res) => {
  const { orderId } = req.query;

  // Sample order
  const mockOrder = {
    id: orderId || 'sample-order-id',
    studentId: '660e8400-e29b-41d4-a716-446655440001',
    items: [
      {
        id: '770e8400-e29b-41d4-a716-446655440001',
        name: 'Chicken Sandwich',
        price: 8.50,
        quantity: 1,
        category: 'main_course'
      }
    ],
    totalAmount: 8.50,
    deliveryDate: '2025-01-16',
    status: 'pending',
    paymentStatus: 'pending',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z'
  };

  res.json({
    success: true,
    order: mockOrder,
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = {
    totalOrders: 42,
    pendingOrders: 8,
    processingOrders: 5,
    completedOrders: 25,
    cancelledOrders: 4,
    averageOrderValue: 12.75,
    totalRevenue: 535.50,
    systemUptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };

  res.json({
    success: true,
    metrics,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString(),
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Flexischools Order-Processing Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Orders API: http://localhost:${PORT}/orders`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;