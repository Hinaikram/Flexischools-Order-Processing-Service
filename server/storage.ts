import { users, orders, menuItems, orderItems, inventory, type User, type InsertUser, type Order, type InsertOrder, type MenuItem, type InsertMenuItem, type OrderItem, type InsertOrderItem } from "../shared/schema";
import { db } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;

  // Order operations
  getOrders(filters?: {
    studentId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: Order[], totalCount: number }>;
  getOrderById(id: string): Promise<Order | undefined>;
  createOrder(insertOrder: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;

  // Menu item operations
  getMenuItems(filters?: {
    category?: string;
    isAvailable?: boolean;
  }): Promise<MenuItem[]>;
  getMenuItemById(id: string): Promise<MenuItem | undefined>;
  createMenuItem(insertMenuItem: InsertMenuItem): Promise<MenuItem>;

  // Order item operations
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Order operations
  async getOrders(filters?: {
    studentId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: Order[], totalCount: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    let query = db.select().from(orders);
    let countQuery = db.select({ count: orders.id }).from(orders);

    const conditions = [];
    if (filters?.studentId) {
      conditions.push(eq(orders.studentId, filters.studentId));
    }
    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }

    if (conditions.length > 0) {
      const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(condition);
      countQuery = countQuery.where(condition);
    }

    const [ordersResult, countResult] = await Promise.all([
      query.orderBy(desc(orders.createdAt)).limit(limit).offset(offset),
      countQuery
    ]);

    return {
      orders: ordersResult,
      totalCount: countResult.length
    };
  }

  async getOrderById(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db
      .insert(orders)
      .values(insertOrder)
      .returning();
    return order;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [order] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return order || undefined;
  }

  // Menu item operations
  async getMenuItems(filters?: {
    category?: string;
    isAvailable?: boolean;
  }): Promise<MenuItem[]> {
    let query = db.select().from(menuItems);

    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(menuItems.category, filters.category));
    }
    if (filters?.isAvailable !== undefined) {
      conditions.push(eq(menuItems.isAvailable, filters.isAvailable ? 1 : 0));
    }

    if (conditions.length > 0) {
      const condition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(condition);
    }

    return query.orderBy(asc(menuItems.name));
  }

  async getMenuItemById(id: string): Promise<MenuItem | undefined> {
    const [menuItem] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return menuItem || undefined;
  }

  async createMenuItem(insertMenuItem: InsertMenuItem): Promise<MenuItem> {
    const [menuItem] = await db
      .insert(menuItems)
      .values(insertMenuItem)
      .returning();
    return menuItem;
  }

  // Order item operations
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const [orderItem] = await db
      .insert(orderItems)
      .values(insertOrderItem)
      .returning();
    return orderItem;
  }
}

export const storage = new DatabaseStorage();