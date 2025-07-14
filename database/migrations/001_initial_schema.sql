-- Flexischools Order-Processing Service Database Schema
-- Version: 1.0.0
-- Description: Initial schema for order processing system

-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types for order status
CREATE TYPE order_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'cancelled',
    'failed'
);

-- Create enum types for payment status
CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded'
);

-- Create enum types for item categories
CREATE TYPE item_category AS ENUM (
    'main_course',
    'side_dish',
    'dessert',
    'drink',
    'snack',
    'healthy_option'
);

-- Create schools table
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'Australia',
    phone VARCHAR(20),
    email VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Australia/Sydney',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create students table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    class_name VARCHAR(50),
    year_level INTEGER,
    parent_email VARCHAR(255),
    parent_phone VARCHAR(20),
    dietary_requirements TEXT[],
    allergies TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, student_number)
);

-- Create menu_items table
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category item_category NOT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    ingredients TEXT[],
    allergens TEXT[],
    nutritional_info JSONB,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT TRUE,
    is_healthy BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    items JSONB NOT NULL, -- Array of order items with quantities
    total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
    delivery_date DATE NOT NULL,
    delivery_time TIME,
    special_instructions TEXT,
    status order_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table for detailed tracking
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10, 2) NOT NULL CHECK (total_price >= 0),
    special_requests TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'AUD',
    payment_method VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(255),
    gateway_response JSONB,
    status payment_status DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory table
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    initial_quantity INTEGER NOT NULL CHECK (initial_quantity >= 0),
    current_quantity INTEGER NOT NULL CHECK (current_quantity >= 0),
    reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
    minimum_threshold INTEGER DEFAULT 0 CHECK (minimum_threshold >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(menu_item_id, school_id, date)
);

-- Create delivery_schedules table
CREATE TABLE delivery_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    delivery_date DATE NOT NULL,
    delivery_time TIME NOT NULL,
    cutoff_time TIMESTAMP WITH TIME ZONE NOT NULL,
    max_orders INTEGER,
    current_orders INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, delivery_date, delivery_time)
);

-- Create audit_logs table for tracking changes
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    user_email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX idx_students_school_id ON students(school_id);
CREATE INDEX idx_students_student_number ON students(student_number);
CREATE INDEX idx_students_is_active ON students(is_active);

CREATE INDEX idx_menu_items_school_id ON menu_items(school_id);
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);

CREATE INDEX idx_orders_student_id ON orders(student_id);
CREATE INDEX idx_orders_school_id ON orders(school_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_order_number ON orders(order_number);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

CREATE INDEX idx_inventory_menu_item_id ON inventory(menu_item_id);
CREATE INDEX idx_inventory_school_id ON inventory(school_id);
CREATE INDEX idx_inventory_date ON inventory(date);

CREATE INDEX idx_delivery_schedules_school_id ON delivery_schedules(school_id);
CREATE INDEX idx_delivery_schedules_delivery_date ON delivery_schedules(delivery_date);
CREATE INDEX idx_delivery_schedules_is_active ON delivery_schedules(is_active);

CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_schools_updated_at
    BEFORE UPDATE ON schools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_schedules_updated_at
    BEFORE UPDATE ON delivery_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    order_number TEXT;
BEGIN
    -- Generate order number with format: ORD-YYYYMMDD-XXXX
    order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                    LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
    RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE order_number_seq START 1;

-- Create trigger to auto-generate order numbers
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- Create function for audit logging
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_values)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for important tables
CREATE TRIGGER audit_orders_trigger
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payments_trigger
    AFTER INSERT OR UPDATE OR DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_students_trigger
    AFTER INSERT OR UPDATE OR DELETE ON students
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Create function to calculate order totals
CREATE OR REPLACE FUNCTION calculate_order_total(order_items JSONB)
RETURNS DECIMAL AS $$
DECLARE
    total DECIMAL := 0;
    item JSONB;
BEGIN
    FOR item IN SELECT * FROM jsonb_array_elements(order_items)
    LOOP
        total := total + ((item->>'price')::DECIMAL * (item->>'quantity')::INTEGER);
    END LOOP;
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Create function to check inventory availability
CREATE OR REPLACE FUNCTION check_inventory_availability(
    p_menu_item_id UUID,
    p_school_id UUID,
    p_date DATE,
    p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    available_quantity INTEGER;
BEGIN
    SELECT (current_quantity - reserved_quantity) INTO available_quantity
    FROM inventory
    WHERE menu_item_id = p_menu_item_id
      AND school_id = p_school_id
      AND date = p_date;
    
    RETURN COALESCE(available_quantity, 0) >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- Create function to reserve inventory
CREATE OR REPLACE FUNCTION reserve_inventory(
    p_menu_item_id UUID,
    p_school_id UUID,
    p_date DATE,
    p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE inventory
    SET reserved_quantity = reserved_quantity + p_quantity,
        updated_at = CURRENT_TIMESTAMP
    WHERE menu_item_id = p_menu_item_id
      AND school_id = p_school_id
      AND date = p_date
      AND (current_quantity - reserved_quantity) >= p_quantity;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to release inventory
CREATE OR REPLACE FUNCTION release_inventory(
    p_menu_item_id UUID,
    p_school_id UUID,
    p_date DATE,
    p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE inventory
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        updated_at = CURRENT_TIMESTAMP
    WHERE menu_item_id = p_menu_item_id
      AND school_id = p_school_id
      AND date = p_date;
END;
$$ LANGUAGE plpgsql;

-- Create function to consume inventory
CREATE OR REPLACE FUNCTION consume_inventory(
    p_menu_item_id UUID,
    p_school_id UUID,
    p_date DATE,
    p_quantity INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE inventory
    SET current_quantity = current_quantity - p_quantity,
        reserved_quantity = GREATEST(0, reserved_quantity - p_quantity),
        updated_at = CURRENT_TIMESTAMP
    WHERE menu_item_id = p_menu_item_id
      AND school_id = p_school_id
      AND date = p_date;
END;
$$ LANGUAGE plpgsql;

-- Create views for reporting
CREATE VIEW daily_order_summary AS
SELECT 
    o.delivery_date,
    o.school_id,
    s.name as school_name,
    COUNT(o.id) as total_orders,
    SUM(o.total_amount) as total_revenue,
    COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
    COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
    AVG(o.total_amount) as average_order_value
FROM orders o
JOIN schools s ON o.school_id = s.id
GROUP BY o.delivery_date, o.school_id, s.name;

CREATE VIEW popular_menu_items AS
SELECT 
    mi.id,
    mi.name,
    mi.category,
    mi.price,
    COUNT(oi.id) as order_count,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.total_price) as total_revenue
FROM menu_items mi
JOIN order_items oi ON mi.id = oi.menu_item_id
JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'completed'
  AND o.delivery_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY mi.id, mi.name, mi.category, mi.price
ORDER BY order_count DESC;

CREATE VIEW student_order_history AS
SELECT 
    st.id as student_id,
    st.first_name,
    st.last_name,
    st.student_number,
    sc.name as school_name,
    COUNT(o.id) as total_orders,
    SUM(o.total_amount) as total_spent,
    AVG(o.total_amount) as average_order_value,
    MAX(o.created_at) as last_order_date
FROM students st
JOIN schools sc ON st.school_id = sc.id
LEFT JOIN orders o ON st.id = o.student_id
WHERE o.status = 'completed' OR o.status IS NULL
GROUP BY st.id, st.first_name, st.last_name, st.student_number, sc.name;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flexischools_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flexischools_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO flexischools_app;

-- Create application user (this should be run separately with appropriate credentials)
-- CREATE USER flexischools_app WITH PASSWORD 'secure_password_from_secrets_manager';

-- Insert initial data will be handled by seed files
COMMENT ON DATABASE flexischools_orders IS 'Flexischools Order Processing System Database';
COMMENT ON SCHEMA public IS 'Main schema for Flexischools order processing';
