const http = require('http');
const url = require('url');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Configure WebSocket constructor for Neon
neonConfig.webSocketConstructor = ws;

const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
const server = http.createServer(async (req, res) => {
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

  try {
    // Health check endpoint
    if (path === '/health' && method === 'GET') {
      // Test database connection
      let dbStatus = 'healthy';
      try {
        const result = await pool.query('SELECT 1');
        dbStatus = result.rows.length > 0 ? 'healthy' : 'unhealthy';
      } catch (error) {
        dbStatus = 'error';
      }

      const checks = {
        database: dbStatus,
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
      
      let queryText = `
        SELECT o.*, u.username, u.first_name, u.last_name 
        FROM orders o 
        JOIN users u ON o.student_id = u.id
      `;
      const queryParams = [];
      const conditions = [];

      if (studentId) {
        conditions.push(`o.student_id = $${queryParams.length + 1}`);
        queryParams.push(studentId);
      }

      if (status) {
        conditions.push(`o.status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }

      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }

      queryText += ' ORDER BY o.created_at DESC';

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      queryText += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(Number(limit), offset);

      const result = await pool.query(queryText, queryParams);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM orders o';
      const countParams = [];
      if (studentId) {
        countQuery += ' WHERE o.student_id = $1';
        countParams.push(studentId);
      }
      if (status) {
        countQuery += studentId ? ' AND o.status = $2' : ' WHERE o.status = $1';
        countParams.push(status);
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        result.rows.map(async (order) => {
          const itemsQuery = `
            SELECT oi.*, mi.name, mi.description, mi.category 
            FROM order_items oi
            JOIN menu_items mi ON oi.menu_item_id = mi.id
            WHERE oi.order_id = $1
          `;
          const itemsResult = await pool.query(itemsQuery, [order.id]);
          
          return {
            ...order,
            items: itemsResult.rows.map(item => ({
              id: item.id,
              name: item.name,
              description: item.description,
              price: parseFloat(item.unit_price),
              quantity: item.quantity,
              category: item.category,
              totalPrice: parseFloat(item.total_price)
            }))
          };
        })
      );

      sendJSONResponse(res, 200, {
        success: true,
        orders: ordersWithItems,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / Number(limit)),
        },
      });
      return;
    }

    // Create order endpoint
    if (path === '/orders' && method === 'POST') {
      parseRequestBody(req, async (error, data) => {
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

        try {
          // Start transaction
          await pool.query('BEGIN');

          // Insert order
          const orderQuery = `
            INSERT INTO orders (student_id, total_amount, delivery_date, special_instructions)
            VALUES ($1, $2, $3, $4)
            RETURNING *
          `;
          const orderResult = await pool.query(orderQuery, [studentId, totalAmount, deliveryDate, specialInstructions]);
          const order = orderResult.rows[0];

          // Insert order items
          const orderItems = [];
          for (const item of items) {
            const itemQuery = `
              INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price)
              VALUES ($1, $2, $3, $4, $5)
              RETURNING *
            `;
            const itemResult = await pool.query(itemQuery, [
              order.id,
              item.menuItemId || item.id,
              item.quantity || 1,
              item.price,
              (item.price * (item.quantity || 1))
            ]);
            orderItems.push(itemResult.rows[0]);
          }

          // Commit transaction
          await pool.query('COMMIT');

          console.log('Order created:', order);

          sendJSONResponse(res, 201, {
            success: true,
            order: {
              ...order,
              items: orderItems
            },
          });
        } catch (dbError) {
          await pool.query('ROLLBACK');
          console.error('Database error:', dbError);
          sendJSONResponse(res, 500, {
            error: 'Database error',
            message: 'Failed to create order',
            timestamp: new Date().toISOString(),
          });
        }
      });
      return;
    }

    // Order details endpoint
    if (path === '/orders/details' && method === 'GET') {
      const { orderId } = query;

      if (!orderId) {
        sendJSONResponse(res, 400, {
          error: 'Missing orderId parameter',
          message: 'orderId is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const orderQuery = `
        SELECT o.*, u.username, u.first_name, u.last_name 
        FROM orders o 
        JOIN users u ON o.student_id = u.id
        WHERE o.id = $1
      `;
      const orderResult = await pool.query(orderQuery, [orderId]);

      if (orderResult.rows.length === 0) {
        sendJSONResponse(res, 404, {
          error: 'Order not found',
          message: 'Order with the specified ID does not exist',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const order = orderResult.rows[0];

      // Get order items
      const itemsQuery = `
        SELECT oi.*, mi.name, mi.description, mi.category 
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = $1
      `;
      const itemsResult = await pool.query(itemsQuery, [orderId]);

      const orderWithItems = {
        ...order,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: parseFloat(item.unit_price),
          quantity: item.quantity,
          category: item.category,
          totalPrice: parseFloat(item.total_price)
        }))
      };

      sendJSONResponse(res, 200, {
        success: true,
        order: orderWithItems,
      });
      return;
    }

    // Menu items endpoint
    if (path === '/menu' && method === 'GET') {
      const { category, available } = query;

      let queryText = 'SELECT * FROM menu_items';
      const queryParams = [];
      const conditions = [];

      if (category) {
        conditions.push(`category = $${queryParams.length + 1}`);
        queryParams.push(category);
      }

      if (available !== undefined) {
        conditions.push(`is_available = $${queryParams.length + 1}`);
        queryParams.push(available === 'true' ? 1 : 0);
      }

      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }

      queryText += ' ORDER BY name';

      const result = await pool.query(queryText, queryParams);

      sendJSONResponse(res, 200, {
        success: true,
        menuItems: result.rows,
      });
      return;
    }

    // Metrics endpoint
    if (path === '/metrics' && method === 'GET') {
      const metricsQuery = `
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          COALESCE(AVG(total_amount), 0) as average_order_value,
          COALESCE(SUM(total_amount), 0) as total_revenue
        FROM orders
      `;

      const result = await pool.query(metricsQuery);
      const metrics = result.rows[0];

      sendJSONResponse(res, 200, {
        success: true,
        metrics: {
          totalOrders: parseInt(metrics.total_orders),
          pendingOrders: parseInt(metrics.pending_orders),
          processingOrders: parseInt(metrics.processing_orders),
          completedOrders: parseInt(metrics.completed_orders),
          cancelledOrders: parseInt(metrics.cancelled_orders),
          averageOrderValue: parseFloat(metrics.average_order_value),
          totalRevenue: parseFloat(metrics.total_revenue),
          systemUptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        },
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

  } catch (error) {
    console.error('Server error:', error);
    sendJSONResponse(res, 500, {
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    });
  }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Flexischools Order-Processing Service with Database running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Orders API: http://localhost:${PORT}/orders`);
  console.log(`🍽️ Menu API: http://localhost:${PORT}/menu`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    pool.end();
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    pool.end();
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = server;