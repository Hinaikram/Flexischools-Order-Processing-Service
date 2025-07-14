const http = require('http');
const url = require('url');
const querystring = require('querystring');

const PORT = process.env.PORT || 5000;

// Helper function to parse JSON request body
function parseRequestBody(req, callback) {
  if (req.method === 'POST' && req.headers['content-type'] === 'application/json') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        callback(null, data);
      } catch (error) {
        callback(error);
      }
    });
  } else {
    callback(null, null);
  }
}

// Helper function to send JSON response
function sendJSONResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data, null, 2));
}

// Create server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  console.log(`${method} ${path} - ${new Date().toISOString()}`);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // Health check endpoint
  if (path === '/health' && method === 'GET') {
    const checks = {
      database: 'healthy',
      sqs: 'healthy',
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };

    sendJSONResponse(res, 200, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      checks,
    });
    return;
  }

  // Ready endpoint
  if (path === '/ready' && method === 'GET') {
    sendJSONResponse(res, 200, {
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Get orders endpoint
  if (path === '/orders' && method === 'GET') {
    const { studentId, status, page = 1, limit = 10 } = query;
    
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
    const startIndex = (Number(page) - 1) * Number(limit);
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + Number(limit));

    sendJSONResponse(res, 200, {
      success: true,
      orders: paginatedOrders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages,
      },
    });
    return;
  }

  // Create order endpoint
  if (path === '/orders' && method === 'POST') {
    parseRequestBody(req, (error, data) => {
      if (error) {
        sendJSONResponse(res, 400, {
          error: 'Invalid JSON',
          message: 'Request body is not valid JSON',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { studentId, items, totalAmount, deliveryDate, specialInstructions } = data || {};

      // Validate required fields
      if (!studentId || !items || !totalAmount || !deliveryDate) {
        sendJSONResponse(res, 400, {
          error: 'Validation failed',
          message: 'Missing required fields: studentId, items, totalAmount, deliveryDate',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Validate items array
      if (!Array.isArray(items) || items.length === 0) {
        sendJSONResponse(res, 400, {
          error: 'Validation failed',
          message: 'Items must be a non-empty array',
          timestamp: new Date().toISOString(),
        });
        return;
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

      sendJSONResponse(res, 201, {
        success: true,
        order,
      });
    });
    return;
  }

  // Order details endpoint
  if (path === '/orders/details' && method === 'GET') {
    const { orderId } = query;

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

    sendJSONResponse(res, 200, {
      success: true,
      order: mockOrder,
    });
    return;
  }

  // Metrics endpoint
  if (path === '/metrics' && method === 'GET') {
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

    sendJSONResponse(res, 200, {
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 404 handler
  sendJSONResponse(res, 404, {
    error: 'Not found',
    message: 'The requested resource was not found',
    timestamp: new Date().toISOString(),
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Flexischools Order-Processing Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Orders API: http://localhost:${PORT}/orders`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = server;