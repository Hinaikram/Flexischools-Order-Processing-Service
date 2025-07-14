import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Pool } from 'pg';
import { Logger } from 'winston';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export interface Order {
  id: string;
  student_id: string;
  items: OrderItem[];
  total_amount: number;
  delivery_date: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';
  created_at: Date;
  updated_at?: Date;
}

export class OrderProcessor {
  private sqsClient: SQSClient;
  private dbPool: Pool;
  private queueUrl: string;
  private logger: Logger;
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(
    sqsClient: SQSClient,
    dbPool: Pool,
    queueUrl: string,
    logger: Logger
  ) {
    this.sqsClient = sqsClient;
    this.dbPool = dbPool;
    this.queueUrl = queueUrl;
    this.logger = logger;
  }

  /**
   * Start the order processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Order processor is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting order processor');

    // Start processing messages in intervals
    this.processingInterval = setInterval(async () => {
      try {
        await this.processMessages();
      } catch (error) {
        this.logger.error('Error processing messages', error);
      }
    }, 5000); // Process every 5 seconds

    this.logger.info('Order processor started successfully');
  }

  /**
   * Stop the order processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Order processor is not running');
      return;
    }

    this.logger.info('Stopping order processor');
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    this.logger.info('Order processor stopped successfully');
  }

  /**
   * Process an order by sending it to SQS
   */
  async processOrder(order: Order): Promise<void> {
    try {
      const message = {
        id: order.id,
        studentId: order.student_id,
        items: order.items,
        totalAmount: order.total_amount,
        deliveryDate: order.delivery_date,
        status: order.status,
        createdAt: order.created_at,
        timestamp: new Date().toISOString(),
      };

      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          OrderId: {
            DataType: 'String',
            StringValue: order.id,
          },
          StudentId: {
            DataType: 'String',
            StringValue: order.student_id,
          },
          TotalAmount: {
            DataType: 'Number',
            StringValue: order.total_amount.toString(),
          },
        },
      });

      await this.sqsClient.send(command);
      this.logger.info('Order sent to SQS queue', { orderId: order.id });
    } catch (error) {
      this.logger.error('Error sending order to SQS', { orderId: order.id, error });
      throw error;
    }
  }

  /**
   * Process messages from SQS queue
   */
  private async processMessages(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 5,
        MessageAttributeNames: ['All'],
      });

      const response = await this.sqsClient.send(command);

      if (response.Messages) {
        for (const message of response.Messages) {
          await this.processMessage(message);
        }
      }
    } catch (error) {
      this.logger.error('Error receiving messages from SQS', error);
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: any): Promise<void> {
    try {
      const orderData = JSON.parse(message.Body);
      const orderId = orderData.id;

      this.logger.info('Processing order message', { orderId });

      // Update order status to processing
      await this.updateOrderStatus(orderId, 'processing');

      // Simulate order processing
      await this.processOrderLogic(orderData);

      // Update order status to completed
      await this.updateOrderStatus(orderId, 'completed');

      // Delete message from queue
      await this.deleteMessage(message.ReceiptHandle);

      this.logger.info('Order processed successfully', { orderId });
    } catch (error) {
      this.logger.error('Error processing message', { messageId: message.MessageId, error });
      
      // Update order status to failed if possible
      try {
        const orderData = JSON.parse(message.Body);
        await this.updateOrderStatus(orderData.id, 'failed');
      } catch (updateError) {
        this.logger.error('Error updating order status to failed', updateError);
      }
    }
  }

  /**
   * Process order business logic
   */
  private async processOrderLogic(orderData: any): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Validate order data
    if (!orderData.id || !orderData.studentId || !orderData.items) {
      throw new Error('Invalid order data');
    }

    // Check inventory (simulated)
    await this.checkInventory(orderData.items);

    // Process payment (simulated)
    await this.processPayment(orderData.studentId, orderData.totalAmount);

    // Update inventory (simulated)
    await this.updateInventory(orderData.items);

    // Schedule delivery (simulated)
    await this.scheduleDelivery(orderData.id, orderData.deliveryDate);

    this.logger.info('Order logic processed successfully', { orderId: orderData.id });
  }

  /**
   * Check inventory availability
   */
  private async checkInventory(items: OrderItem[]): Promise<void> {
    // Simulate inventory check
    for (const item of items) {
      // Check if item is available
      const available = Math.random() > 0.1; // 90% availability rate
      
      if (!available) {
        throw new Error(`Item ${item.name} is not available`);
      }
    }

    this.logger.debug('Inventory check completed', { itemCount: items.length });
  }

  /**
   * Process payment
   */
  private async processPayment(studentId: string, amount: number): Promise<void> {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate payment failure
    const paymentSuccess = Math.random() > 0.05; // 95% success rate
    
    if (!paymentSuccess) {
      throw new Error('Payment processing failed');
    }

    this.logger.debug('Payment processed successfully', { studentId, amount });
  }

  /**
   * Update inventory
   */
  private async updateInventory(items: OrderItem[]): Promise<void> {
    // Simulate inventory update
    for (const item of items) {
      // Update inventory count
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.debug('Inventory updated successfully', { itemCount: items.length });
  }

  /**
   * Schedule delivery
   */
  private async scheduleDelivery(orderId: string, deliveryDate: string): Promise<void> {
    // Simulate delivery scheduling
    await new Promise(resolve => setTimeout(resolve, 200));

    this.logger.debug('Delivery scheduled successfully', { orderId, deliveryDate });
  }

  /**
   * Update order status in database
   */
  private async updateOrderStatus(orderId: string, status: Order['status']): Promise<void> {
    try {
      const query = `
        UPDATE orders 
        SET status = $1, updated_at = NOW() 
        WHERE id = $2
        RETURNING id, status, updated_at
      `;

      const result = await this.dbPool.query(query, [status, orderId]);

      if (result.rows.length === 0) {
        throw new Error(`Order ${orderId} not found`);
      }

      this.logger.info('Order status updated', { 
        orderId, 
        status, 
        updatedAt: result.rows[0].updated_at 
      });
    } catch (error) {
      this.logger.error('Error updating order status', { orderId, status, error });
      throw error;
    }
  }

  /**
   * Delete message from SQS queue
   */
  private async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      });

      await this.sqsClient.send(command);
      this.logger.debug('Message deleted from queue', { receiptHandle });
    } catch (error) {
      this.logger.error('Error deleting message from queue', { receiptHandle, error });
      throw error;
    }
  }

  /**
   * Get order processing statistics
   */
  async getProcessingStats(): Promise<any> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
          COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_orders,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
          AVG(
            CASE 
              WHEN status = 'completed' AND updated_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (updated_at - created_at)) 
            END
          ) as avg_processing_time_seconds
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `;

      const result = await this.dbPool.query(query);
      const stats = result.rows[0];

      return {
        totalOrders: parseInt(stats.total_orders),
        pendingOrders: parseInt(stats.pending_orders),
        processingOrders: parseInt(stats.processing_orders),
        completedOrders: parseInt(stats.completed_orders),
        failedOrders: parseInt(stats.failed_orders),
        cancelledOrders: parseInt(stats.cancelled_orders),
        averageProcessingTime: parseFloat(stats.avg_processing_time_seconds) || 0,
        processorStatus: this.isRunning ? 'running' : 'stopped',
      };
    } catch (error) {
      this.logger.error('Error getting processing stats', error);
      throw error;
    }
  }

  /**
   * Reprocess failed orders
   */
  async reprocessFailedOrders(): Promise<void> {
    try {
      const query = `
        SELECT id, student_id, items, total_amount, delivery_date, status, created_at
        FROM orders
        WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at ASC
      `;

      const result = await this.dbPool.query(query);
      
      for (const order of result.rows) {
        try {
          // Reset order status to pending
          await this.updateOrderStatus(order.id, 'pending');
          
          // Reprocess the order
          await this.processOrder(order);
          
          this.logger.info('Failed order reprocessed', { orderId: order.id });
        } catch (error) {
          this.logger.error('Error reprocessing failed order', { orderId: order.id, error });
        }
      }

      this.logger.info('Failed orders reprocessing completed', { count: result.rows.length });
    } catch (error) {
      this.logger.error('Error reprocessing failed orders', error);
      throw error;
    }
  }
}
