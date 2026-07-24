-- =============================================================================
-- MULTI-BRANCH OPTICAL SHOP POS & REPORTING SYSTEM - SUPABASE DATABASE SCHEMA
-- =============================================================================

-- Clean up existing objects if any
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP FUNCTION IF EXISTS deduct_product_stock() CASCADE;

-- 1. BRANCHES TABLE
CREATE TABLE branches (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    address TEXT,
    phone VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES / USERS TABLE
CREATE TABLE profiles (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL DEFAULT 'demo123',
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'admin', 'cashier')),
    branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CUSTOMERS TABLE
CREATE TABLE customers (
    id VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OPTICAL PRESCRIPTIONS TABLE
CREATE TABLE prescriptions (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    od_sph NUMERIC(4,2) DEFAULT 0.00,
    od_cyl NUMERIC(4,2) DEFAULT 0.00,
    od_axis INT DEFAULT 0 CHECK (od_axis BETWEEN 0 AND 180),
    od_add NUMERIC(4,2) DEFAULT 0.00,
    os_sph NUMERIC(4,2) DEFAULT 0.00,
    os_cyl NUMERIC(4,2) DEFAULT 0.00,
    os_axis INT DEFAULT 0 CHECK (os_axis BETWEEN 0 AND 180),
    os_add NUMERIC(4,2) DEFAULT 0.00,
    pd NUMERIC(4,1) DEFAULT 63.0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCTS / INVENTORY TABLE (Includes image_url)
CREATE TABLE products (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Frames', 'Lenses', 'Contact Lenses', 'Accessories', 'Services')),
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    prescription_type VARCHAR(50) DEFAULT 'Standard',
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_branch_sku UNIQUE (branch_id, sku)
);

-- 6. ORDERS TABLE
CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(id),
    customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE SET NULL,
    prescription_id VARCHAR(50) REFERENCES prescriptions(id) ON DELETE SET NULL,
    cashier_id VARCHAR(50) REFERENCES profiles(id) ON DELETE SET NULL,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('Cash', 'Credit Card', 'Mobile Banking', 'QR Code')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Paid' CHECK (payment_status IN ('Paid', 'Pending', 'Refunded')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ORDER ITEMS TABLE
CREATE TABLE order_items (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0)
);

-- =============================================================================
-- AUTOMATED INVENTORY STOCK DEDUCTION TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION deduct_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.product_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deduct_product_stock ON order_items;
CREATE TRIGGER trigger_deduct_product_stock
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION deduct_product_stock();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branches Read Policy" ON branches FOR SELECT USING (true);
CREATE POLICY "Branches Write Policy" ON branches FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Profiles Read Policy" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles Write Policy" ON profiles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Customers Read Write Policy" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Prescriptions Read Write Policy" ON prescriptions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Products Read Policy" ON products FOR SELECT USING (true);
CREATE POLICY "Products Write Policy" ON products FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Orders Read Policy" ON orders FOR SELECT USING (true);
CREATE POLICY "Orders Insert Policy" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders Delete Policy" ON orders FOR DELETE USING (true);

CREATE POLICY "Order Items Read Policy" ON order_items FOR SELECT USING (true);
CREATE POLICY "Order Items Insert Policy" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Order Items Delete Policy" ON order_items FOR DELETE USING (true);


-- =============================================================================
-- NOTE: No seed data is included. All data is managed through the application
-- via the Supabase database. Use the POS admin panel to create branches,
-- users, and products.
-- =============================================================================
