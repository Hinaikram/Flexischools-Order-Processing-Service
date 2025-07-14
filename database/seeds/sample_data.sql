-- Flexischools Order-Processing Service Sample Data
-- This file contains sample data for development and testing purposes
-- DO NOT USE IN PRODUCTION - This is for testing only

-- Insert sample schools
INSERT INTO schools (id, name, code, address, city, state, postal_code, phone, email, timezone) VALUES
(
    '550e8400-e29b-41d4-a716-446655440001',
    'Sunset Primary School',
    'SUNSET_PS',
    '123 Education Street',
    'Sydney',
    'NSW',
    '2000',
    '+61 2 9876 5432',
    'admin@sunsetprimary.edu.au',
    'Australia/Sydney'
),
(
    '550e8400-e29b-41d4-a716-446655440002',
    'Riverside High School',
    'RIVERSIDE_HS',
    '456 Learning Avenue',
    'Melbourne',
    'VIC',
    '3000',
    '+61 3 8765 4321',
    'office@riversidehigh.edu.au',
    'Australia/Melbourne'
),
(
    '550e8400-e29b-41d4-a716-446655440003',
    'Mountain View College',
    'MOUNTAIN_VC',
    '789 Knowledge Boulevard',
    'Brisbane',
    'QLD',
    '4000',
    '+61 7 7654 3210',
    'reception@mountainview.edu.au',
    'Australia/Brisbane'
);

-- Insert sample students
INSERT INTO students (id, school_id, student_number, first_name, last_name, date_of_birth, class_name, year_level, parent_email, parent_phone, dietary_requirements, allergies) VALUES
(
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'STU001',
    'Emma',
    'Johnson',
    '2012-03-15',
    '5A',
    5,
    'sarah.johnson@email.com',
    '+61 400 123 456',
    ARRAY['vegetarian'],
    ARRAY['nuts']
),
(
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'STU002',
    'Liam',
    'Smith',
    '2013-07-22',
    '4B',
    4,
    'mike.smith@email.com',
    '+61 400 234 567',
    ARRAY[]::TEXT[],
    ARRAY['dairy', 'eggs']
),
(
    '660e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440001',
    'STU003',
    'Olivia',
    'Brown',
    '2011-11-08',
    '6C',
    6,
    'jessica.brown@email.com',
    '+61 400 345 678',
    ARRAY['gluten-free'],
    ARRAY['gluten']
),
(
    '660e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440002',
    'STU004',
    'Noah',
    'Davis',
    '2008-05-12',
    '9A',
    9,
    'amanda.davis@email.com',
    '+61 400 456 789',
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[]
),
(
    '660e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440002',
    'STU005',
    'Sophia',
    'Wilson',
    '2009-09-30',
    '8B',
    8,
    'robert.wilson@email.com',
    '+61 400 567 890',
    ARRAY['vegan'],
    ARRAY['soy']
),
(
    '660e8400-e29b-41d4-a716-446655440006',
    '550e8400-e29b-41d4-a716-446655440003',
    'STU006',
    'Jackson',
    'Taylor',
    '2010-01-25',
    '7A',
    7,
    'lisa.taylor@email.com',
    '+61 400 678 901',
    ARRAY[]::TEXT[],
    ARRAY['shellfish']
);

-- Insert sample menu items
INSERT INTO menu_items (id, school_id, name, description, category, price, ingredients, allergens, nutritional_info, is_healthy) VALUES
(
    '770e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'Chicken Sandwich',
    'Grilled chicken breast with lettuce and tomato on wholemeal bread',
    'main_course',
    8.50,
    ARRAY['chicken breast', 'wholemeal bread', 'lettuce', 'tomato', 'mayonnaise'],
    ARRAY['gluten', 'eggs'],
    '{"calories": 320, "protein": 28, "carbs": 35, "fat": 8, "sodium": 680}'::jsonb,
    true
),
(
    '770e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'Margherita Pizza Slice',
    'Traditional pizza with tomato sauce, mozzarella, and basil',
    'main_course',
    6.00,
    ARRAY['pizza dough', 'tomato sauce', 'mozzarella cheese', 'basil'],
    ARRAY['gluten', 'dairy'],
    '{"calories": 285, "protein": 12, "carbs": 36, "fat": 10, "sodium": 640}'::jsonb,
    false
),
(
    '770e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440001',
    'Garden Salad',
    'Fresh mixed greens with cucumber, tomato, and carrot',
    'side_dish',
    4.50,
    ARRAY['mixed lettuce', 'cucumber', 'tomato', 'carrot', 'balsamic dressing'],
    ARRAY[]::TEXT[],
    '{"calories": 45, "protein": 2, "carbs": 8, "fat": 2, "sodium": 120}'::jsonb,
    true
),
(
    '770e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440001',
    'Apple Juice',
    '100% pure apple juice, no added sugar',
    'drink',
    3.00,
    ARRAY['apple juice'],
    ARRAY[]::TEXT[],
    '{"calories": 110, "protein": 0, "carbs": 26, "fat": 0, "sodium": 10}'::jsonb,
    true
),
(
    '770e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440001',
    'Chocolate Chip Cookie',
    'Homemade chocolate chip cookie',
    'dessert',
    2.50,
    ARRAY['flour', 'butter', 'sugar', 'chocolate chips', 'eggs'],
    ARRAY['gluten', 'dairy', 'eggs'],
    '{"calories": 150, "protein": 2, "carbs": 20, "fat": 7, "sodium": 95}'::jsonb,
    false
),
(
    '770e8400-e29b-41d4-a716-446655440006',
    '550e8400-e29b-41d4-a716-446655440002',
    'Beef Burger',
    'Grilled beef patty with lettuce, tomato, and cheese on sesame bun',
    'main_course',
    10.00,
    ARRAY['beef patty', 'sesame bun', 'lettuce', 'tomato', 'cheese', 'sauce'],
    ARRAY['gluten', 'dairy', 'sesame'],
    '{"calories": 420, "protein": 25, "carbs": 35, "fat": 22, "sodium": 890}'::jsonb,
    false
),
(
    '770e8400-e29b-41d4-a716-446655440007',
    '550e8400-e29b-41d4-a716-446655440002',
    'Vegetable Wrap',
    'Whole wheat wrap with grilled vegetables and hummus',
    'main_course',
    7.50,
    ARRAY['whole wheat wrap', 'zucchini', 'bell peppers', 'onions', 'hummus'],
    ARRAY['gluten', 'sesame'],
    '{"calories": 280, "protein": 8, "carbs": 42, "fat": 9, "sodium": 520}'::jsonb,
    true
),
(
    '770e8400-e29b-41d4-a716-446655440008',
    '550e8400-e29b-41d4-a716-446655440003',
    'Fish and Chips',
    'Battered fish with seasoned potato chips',
    'main_course',
    12.00,
    ARRAY['white fish', 'batter', 'potatoes', 'oil', 'salt'],
    ARRAY['gluten', 'fish'],
    '{"calories": 520, "protein": 22, "carbs": 45, "fat": 28, "sodium": 1100}'::jsonb,
    false
),
(
    '770e8400-e29b-41d4-a716-446655440009',
    '550e8400-e29b-41d4-a716-446655440003',
    'Fruit Salad',
    'Seasonal fresh fruit mix',
    'dessert',
    4.00,
    ARRAY['apple', 'orange', 'banana', 'grapes', 'strawberries'],
    ARRAY[]::TEXT[],
    '{"calories": 80, "protein": 1, "carbs": 20, "fat": 0, "sodium": 5}'::jsonb,
    true
),
(
    '770e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440003',
    'Water Bottle',
    'Still water 500ml',
    'drink',
    2.00,
    ARRAY['water'],
    ARRAY[]::TEXT[],
    '{"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "sodium": 0}'::jsonb,
    true
);

-- Insert sample delivery schedules
INSERT INTO delivery_schedules (id, school_id, delivery_date, delivery_time, cutoff_time, max_orders, current_orders) VALUES
(
    '880e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    CURRENT_DATE + INTERVAL '1 day',
    '12:00:00',
    CURRENT_TIMESTAMP + INTERVAL '12 hours',
    100,
    0
),
(
    '880e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    CURRENT_DATE + INTERVAL '2 days',
    '12:00:00',
    CURRENT_TIMESTAMP + INTERVAL '36 hours',
    100,
    0
),
(
    '880e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440002',
    CURRENT_DATE + INTERVAL '1 day',
    '12:30:00',
    CURRENT_TIMESTAMP + INTERVAL '12 hours',
    150,
    0
),
(
    '880e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440003',
    CURRENT_DATE + INTERVAL '1 day',
    '13:00:00',
    CURRENT_TIMESTAMP + INTERVAL '12 hours',
    120,
    0
);

-- Insert sample inventory data
INSERT INTO inventory (id, menu_item_id, school_id, date, initial_quantity, current_quantity, minimum_threshold) VALUES
(
    '990e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    CURRENT_DATE + INTERVAL '1 day',
    50,
    50,
    10
),
(
    '990e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    CURRENT_DATE + INTERVAL '1 day',
    30,
    30,
    5
),
(
    '990e8400-e29b-41d4-a716-446655440003',
    '770e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440001',
    CURRENT_DATE + INTERVAL '1 day',
    40,
    40,
    8
),
(
    '990e8400-e29b-41d4-a716-446655440004',
    '770e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440001',
    CURRENT_DATE + INTERVAL '1 day',
    60,
    60,
    15
),
(
    '990e8400-e29b-41d4-a716-446655440005',
    '770e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440001',
    CURRENT_DATE + INTERVAL '1 day',
    25,
    25,
    5
),
(
    '990e8400-e29b-41d4-a716-446655440006',
    '770e8400-e29b-41d4-a716-446655440006',
    '550e8400-e29b-41d4-a716-446655440002',
    CURRENT_DATE + INTERVAL '1 day',
    35,
    35,
    8
),
(
    '990e8400-e29b-41d4-a716-446655440007',
    '770e8400-e29b-41d4-a716-446655440007',
    '550e8400-e29b-41d4-a716-446655440002',
    CURRENT_DATE + INTERVAL '1 day',
    45,
    45,
    10
),
(
    '990e8400-e29b-41d4-a716-446655440008',
    '770e8400-e29b-41d4-a716-446655440008',
    '550e8400-e29b-41d4-a716-446655440003',
    CURRENT_DATE + INTERVAL '1 day',
    20,
    20,
    5
),
(
    '990e8400-e29b-41d4-a716-446655440009',
    '770e8400-e29b-41d4-a716-446655440009',
    '550e8400-e29b-41d4-a716-446655440003',
    CURRENT_DATE + INTERVAL '1 day',
    30,
    30,
    8
),
(
    '990e8400-e29b-41d4-a716-446655440010',
    '770e8400-e29b-41d4-a716-446655440010',
    '550e8400-e29b-41d4-a716-446655440003',
    CURRENT_DATE + INTERVAL '1 day',
    100,
    100,
    20
);

-- Insert sample orders (for testing purposes)
INSERT INTO orders (id, student_id, school_id, order_number, items, total_amount, delivery_date, status, payment_status) VALUES
(
    'aa0e8400-e29b-41d4-a716-446655440001',
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0001',
    '[
        {
            "id": "770e8400-e29b-41d4-a716-446655440001",
            "name": "Chicken Sandwich",
            "price": 8.50,
            "quantity": 1,
            "category": "main_course"
        },
        {
            "id": "770e8400-e29b-41d4-a716-446655440004",
            "name": "Apple Juice",
            "price": 3.00,
            "quantity": 1,
            "category": "drink"
        }
    ]'::jsonb,
    11.50,
    CURRENT_DATE + INTERVAL '1 day',
    'pending',
    'pending'
),
(
    'aa0e8400-e29b-41d4-a716-446655440002',
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0002',
    '[
        {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "name": "Margherita Pizza Slice",
            "price": 6.00,
            "quantity": 1,
            "category": "main_course"
        },
        {
            "id": "770e8400-e29b-41d4-a716-446655440003",
            "name": "Garden Salad",
            "price": 4.50,
            "quantity": 1,
            "category": "side_dish"
        }
    ]'::jsonb,
    10.50,
    CURRENT_DATE + INTERVAL '1 day',
    'processing',
    'completed'
),
(
    'aa0e8400-e29b-41d4-a716-446655440003',
    '660e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440001',
    'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0003',
    '[
        {
            "id": "770e8400-e29b-41d4-a716-446655440007",
            "name": "Vegetable Wrap",
            "price": 7.50,
            "quantity": 1,
            "category": "main_course"
        },
        {
            "id": "770e8400-e29b-41d4-a716-446655440010",
            "name": "Water Bottle",
            "price": 2.00,
            "quantity": 1,
            "category": "drink"
        }
    ]'::jsonb,
    9.50,
    CURRENT_DATE + INTERVAL '2 days',
    'completed',
    'completed'
);

-- Insert corresponding order items
INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, total_price) VALUES
(
    'bb0e8400-e29b-41d4-a716-446655440001',
    'aa0e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440001',
    1,
    8.50,
    8.50
),
(
    'bb0e8400-e29b-41d4-a716-446655440002',
    'aa0e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440004',
    1,
    3.00,
    3.00
),
(
    'bb0e8400-e29b-41d4-a716-446655440003',
    'aa0e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440002',
    1,
    6.00,
    6.00
),
(
    'bb0e8400-e29b-41d4-a716-446655440004',
    'aa0e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440003',
    1,
    4.50,
    4.50
),
(
    'bb0e8400-e29b-41d4-a716-446655440005',
    'aa0e8400-e29b-41d4-a716-446655440003',
    '770e8400-e29b-41d4-a716-446655440007',
    1,
    7.50,
    7.50
),
(
    'bb0e8400-e29b-41d4-a716-446655440006',
    'aa0e8400-e29b-41d4-a716-446655440003',
    '770e8400-e29b-41d4-a716-446655440010',
    1,
    2.00,
    2.00
);

-- Insert sample payments
INSERT INTO payments (id, order_id, amount, payment_method, transaction_id, status) VALUES
(
    'cc0e8400-e29b-41d4-a716-446655440001',
    'aa0e8400-e29b-41d4-a716-446655440001',
    11.50,
    'credit_card',
    'TXN_001_' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT,
    'pending'
),
(
    'cc0e8400-e29b-41d4-a716-446655440002',
    'aa0e8400-e29b-41d4-a716-446655440002',
    10.50,
    'credit_card',
    'TXN_002_' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT,
    'completed'
),
(
    'cc0e8400-e29b-41d4-a716-446655440003',
    'aa0e8400-e29b-41d4-a716-446655440003',
    9.50,
    'paypal',
    'TXN_003_' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT,
    'completed'
);

-- Create indexes for sample data queries (if not already created)
CREATE INDEX IF NOT EXISTS idx_orders_sample_delivery_date ON orders(delivery_date) WHERE delivery_date >= CURRENT_DATE;
CREATE INDEX IF NOT EXISTS idx_inventory_sample_date ON inventory(date) WHERE date >= CURRENT_DATE;

-- Analyze tables for better query performance
ANALYZE schools;
ANALYZE students;
ANALYZE menu_items;
ANALYZE orders;
ANALYZE order_items;
ANALYZE payments;
ANALYZE inventory;
ANALYZE delivery_schedules;

-- Summary of inserted data
SELECT 
    'Sample Data Summary' as info,
    (SELECT COUNT(*) FROM schools) as schools_count,
    (SELECT COUNT(*) FROM students) as students_count,
    (SELECT COUNT(*) FROM menu_items) as menu_items_count,
    (SELECT COUNT(*) FROM orders) as orders_count,
    (SELECT COUNT(*) FROM order_items) as order_items_count,
    (SELECT COUNT(*) FROM payments) as payments_count,
    (SELECT COUNT(*) FROM inventory) as inventory_count,
    (SELECT COUNT(*) FROM delivery_schedules) as delivery_schedules_count;

-- Note: This sample data is for development and testing purposes only
-- It should NOT be used in production environments
COMMENT ON TABLE schools IS 'Contains sample school data for testing';
COMMENT ON TABLE students IS 'Contains sample student data for testing';
COMMENT ON TABLE menu_items IS 'Contains sample menu items for testing';
COMMENT ON TABLE orders IS 'Contains sample orders for testing';
COMMENT ON TABLE order_items IS 'Contains sample order items for testing';
COMMENT ON TABLE payments IS 'Contains sample payment data for testing';
COMMENT ON TABLE inventory IS 'Contains sample inventory data for testing';
COMMENT ON TABLE delivery_schedules IS 'Contains sample delivery schedules for testing';
