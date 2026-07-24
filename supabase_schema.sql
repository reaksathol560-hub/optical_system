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
-- SEED DATA: BRANCHES, USERS, CUSTOMERS, PRESCRIPTIONS & FULL PRODUCT CATALOG WITH PHOTOS
-- =============================================================================

INSERT INTO branches (id, name, code, address, phone) VALUES
('br-downtown', 'Downtown Central Branch', 'BR-DT01', '101 Grand Avenue, Suite 400', '+1 (555) 019-2831'),
('br-citymall', 'City Mall Branch', 'BR-CM02', 'Level 2, City Center Mall', '+1 (555) 018-9942'),
('br-westside', 'Westside Plaza Branch', 'BR-WS03', '450 Westside Boulevard', '+1 (555) 017-4411');

INSERT INTO profiles (id, email, password, full_name, role, branch_id) VALUES
('usr-superadmin', 'superadmin@optical.com', 'demo123', 'Eleanor Vance', 'superadmin', 'br-downtown'),
('usr-admin-dt', 'admin.downtown@optical.com', 'demo123', 'Marcus Brody', 'admin', 'br-downtown'),
('usr-cashier-dt', 'cashier.downtown@optical.com', 'demo123', 'Sophia Turner', 'cashier', 'br-downtown'),
('usr-cashier-cm', 'cashier.citymall@optical.com', 'demo123', 'Liam Henderson', 'cashier', 'br-citymall');

INSERT INTO customers (id, full_name, phone, email, address) VALUES
('cust-john', 'John Doe', '+1 555-1234', 'john.doe@example.com', '12 Pine Street'),
('cust-jane', 'Jane Smith', '+1 555-5678', 'jane.smith@example.com', '88 Elm Avenue'),
('cust-robert', 'Robert Johnson', '+1 555-9012', 'robert.j@example.com', '54 Oak Parkway');

INSERT INTO prescriptions (id, customer_id, od_sph, od_cyl, od_axis, od_add, os_sph, os_cyl, os_axis, os_add, pd, notes) VALUES
('rx-john-01', 'cust-john', -4.50, -1.25, 90, 2.00, -4.75, -1.50, 85, 2.00, 64.0, 'High myopia with presbyopia. Recommend 1.67 High Index Progressive.');

-- Product Catalog Seed (Includes Photo URLs)
INSERT INTO products (id, branch_id, name, sku, category, price, stock, prescription_type, image_url, description) VALUES
('prod-rb-001-dt', 'br-downtown', 'Ray-Ban Wayfarer Classic Black', 'FRM-RB-001', 'Frames', 165.00, 25, 'Frame Only', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80', 'Iconic square black acetate frame.'),
('prod-ok-002-dt', 'br-downtown', 'Oakley Holbrook Matte Black', 'FRM-OK-002', 'Frames', 142.00, 18, 'Frame Only', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=400&q=80', 'Lightweight O Matter frame with metal rivets.'),
('prod-gc-003-dt', 'br-downtown', 'Gucci Lightweight Titanium Gold', 'FRM-GC-003', 'Frames', 320.00, 10, 'Frame Only', 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=400&q=80', 'Premium ultra-light titanium frame.'),
('prod-tf-001-dt', 'br-downtown', 'Tom Ford Round Vintage Tortoise', 'FRM-TF-001', 'Frames', 280.00, 15, 'Frame Only', 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&w=400&q=80', 'Luxury acetate frame with Signature T logo.'),
('prod-pr-002-dt', 'br-downtown', 'Prada Cat-Eye Black Edition', 'FRM-PR-002', 'Frames', 310.00, 12, 'Frame Only', 'https://images.unsplash.com/photo-1508296695146-257a814070b4?auto=format&fit=crop&w=400&q=80', 'High fashion women cat-eye frame.'),
('prod-lns-156-dt', 'br-downtown', 'Single Vision 1.56 Anti-Blue Lens', 'LNS-SV-156', 'Lenses', 75.00, 100, 'Single Vision', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80', 'Standard index with blue light blocking filter.'),
('prod-lns-167-dt', 'br-downtown', 'High Index 1.67 Aspheric Lens', 'LNS-HI-167', 'Lenses', 140.00, 50, 'Single Vision High Index', 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=400&q=80', 'Ultra-thin lightweight lens for high prescriptions.'),
('prod-lns-160-dt', 'br-downtown', 'Premium Progressive HD 1.60 Lens', 'LNS-PRG-160', 'Lenses', 210.00, 30, 'Progressive', 'https://images.unsplash.com/photo-1582142306909-195724d33ffc?auto=format&fit=crop&w=400&q=80', 'Wide digital corridor progressive lens with AR coating.'),
('prod-lns-159-dt', 'br-downtown', 'Transitions Gen8 Photochromic 1.59', 'LNS-TR8-159', 'Lenses', 185.00, 40, 'Photochromic', 'https://images.unsplash.com/photo-1509695507497-903c140c43b0?auto=format&fit=crop&w=400&q=80', 'Fast darkening outdoor photochromic lens.'),
('prod-cnt-001-dt', 'br-downtown', 'Acuvue Oasys Monthly (6 pack)', 'CNT-ACV-001', 'Contact Lenses', 45.00, 60, 'Contact Lens', 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=400&q=80', 'Breathable silicone hydrogel contacts.'),
('prod-acc-001-dt', 'br-downtown', 'Anti-Fog Microfiber Cleaning Cloth', 'ACC-CLT-001', 'Accessories', 8.50, 150, 'N/A', 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=400&q=80', 'Reusable anti-fog microfiber lens cloth.'),
('prod-srv-001-dt', 'br-downtown', 'Comprehensive Eye Exam & Refraction', 'SRV-EXM-001', 'Services', 35.00, 999, 'Service', 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=400&q=80', 'Full visual acuity and ophthalmic check up.');

-- City Mall Branch Seed
INSERT INTO products (id, branch_id, name, sku, category, price, stock, prescription_type, image_url, description) VALUES
('prod-rb-001-cm', 'br-citymall', 'Ray-Ban Wayfarer Classic Black', 'FRM-RB-001', 'Frames', 165.00, 20, 'Frame Only', 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=400&q=80', 'Iconic square black acetate frame.'),
('prod-ok-002-cm', 'br-citymall', 'Oakley Holbrook Matte Black', 'FRM-OK-002', 'Frames', 142.00, 15, 'Frame Only', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=400&q=80', 'Lightweight O Matter frame with metal rivets.'),
('prod-gc-003-cm', 'br-citymall', 'Gucci Lightweight Titanium Gold', 'FRM-GC-003', 'Frames', 320.00, 8, 'Frame Only', 'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=400&q=80', 'Premium ultra-light titanium frame.'),
('prod-lns-156-cm', 'br-citymall', 'Single Vision 1.56 Anti-Blue Lens', 'LNS-SV-156', 'Lenses', 75.00, 80, 'Single Vision', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80', 'Standard index with blue light blocking filter.'),
('prod-srv-001-cm', 'br-citymall', 'Comprehensive Eye Exam & Refraction', 'SRV-EXM-001', 'Services', 35.00, 999, 'Service', 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=400&q=80', 'Full visual acuity and ophthalmic check up.');

-- Sample Order Seed
INSERT INTO orders (id, order_number, branch_id, customer_id, prescription_id, cashier_id, total_amount, payment_method, payment_status, created_at) VALUES
('ord-101', 'ORD-20260724-001', 'br-downtown', 'cust-john', 'rx-john-01', 'usr-cashier-dt', 375.00, 'Credit Card', 'Paid', NOW() - INTERVAL '1 hour');

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, total_price) VALUES
('item-101-1', 'ord-101', 'prod-rb-001-dt', 1, 165.00, 165.00),
('item-101-2', 'ord-101', 'prod-lns-160-dt', 1, 210.00, 210.00);
