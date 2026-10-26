-- =============================================================================
-- Metriva Synthetic B2B Supply Chain & Logistics Demo Database (MySQL 8.4+)
-- =============================================================================
-- All records are 100% synthetic, deterministically generated for testing
-- and demonstration purposes. Contains zero real customer or corporate PII.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS metriva_mysql_demo
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE metriva_mysql_demo;

-- -----------------------------------------------------------------------------
-- 1. Table: suppliers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(120) NOT NULL,
    country VARCHAR(60) NOT NULL,
    tier VARCHAR(30) NOT NULL,
    contact_email VARCHAR(120) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_suppliers_country (country),
    INDEX idx_suppliers_tier (tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Table: inventory_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(60) NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    stock_quantity INT NOT NULL,
    reorder_level INT NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    INDEX idx_inv_category (category),
    INDEX idx_inv_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Table: shipments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    tracking_number VARCHAR(80) UNIQUE NOT NULL,
    origin_country VARCHAR(60) NOT NULL,
    destination_country VARCHAR(60) NOT NULL,
    carrier VARCHAR(80) NOT NULL,
    status VARCHAR(30) NOT NULL,
    freight_cost DECIMAL(10,2) NOT NULL,
    weight_kg DECIMAL(8,2) NOT NULL,
    shipped_at DATETIME NOT NULL,
    delivered_at DATETIME NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    INDEX idx_shipments_status (status),
    INDEX idx_shipments_carrier (carrier),
    INDEX idx_shipments_shipped_at (shipped_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Table: shipment_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipment_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shipment_id INT NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    event_time DATETIME NOT NULL,
    location VARCHAR(100) NOT NULL,
    notes TEXT NULL,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
    INDEX idx_events_shipment (shipment_id),
    INDEX idx_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- Seed Synthetic Data
-- -----------------------------------------------------------------------------
INSERT INTO suppliers (id, supplier_name, country, tier, contact_email, is_active, created_at) VALUES
    (1, 'Apex Semiconductor Corp', 'Taiwan', 'Tier-1', 'contact@apex-semi.example', TRUE, '2025-01-15 08:30:00'),
    (2, 'Nordic Precision Robotics', 'Germany', 'Tier-1', 'orders@nordic-robotics.example', TRUE, '2025-02-10 09:15:00'),
    (3, 'Kyoto Sensor Dynamics', 'Japan', 'Tier-1', 'supply@kyoto-sensor.example', TRUE, '2025-02-28 11:00:00'),
    (4, 'Pacific Optoelectronics', 'South Korea', 'Tier-2', 'sales@pacific-opto.example', TRUE, '2025-03-05 14:20:00'),
    (5, 'Alpine Composite Materials', 'Switzerland', 'Tier-2', 'info@alpine-composite.example', TRUE, '2025-03-12 10:45:00'),
    (6, 'Atlas Precision Castings', 'USA', 'Tier-2', 'support@atlas-castings.example', TRUE, '2025-04-01 16:00:00'),
    (7, 'Veritas Thermal Systems', 'Canada', 'Tier-3', 'orders@veritas-thermal.example', TRUE, '2025-04-18 09:30:00'),
    (8, 'SingaTech Connectors', 'Singapore', 'Tier-3', 'contact@singatech.example', TRUE, '2025-05-02 13:10:00'),
    (9, 'Bavaria Power Modules', 'Germany', 'Tier-1', 'info@bavaria-power.example', TRUE, '2025-05-20 15:40:00'),
    (10, 'AeroAlloy Specialty Steels', 'UK', 'Tier-3', 'sales@aeroalloy.example', FALSE, '2025-06-11 11:25:00')
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO inventory_items (id, supplier_id, sku, item_name, category, unit_cost, stock_quantity, reorder_level, updated_at) VALUES
    (1, 1, 'SEMI-FPGA-902', 'UltraScale FPGA 16nm SoC', 'Electronics', 420.00, 1450, 300, '2026-01-10 10:00:00'),
    (2, 1, 'SEMI-MCU-440', 'Arm Cortex-M7 Microcontroller', 'Electronics', 18.50, 12500, 2000, '2026-01-12 11:30:00'),
    (3, 2, 'ROBO-ACT-101', 'Brushless Harmonic Actuator 48V', 'Mechanical', 680.00, 320, 50, '2026-01-15 14:00:00'),
    (4, 2, 'ROBO-GRIP-205', 'Pneumatic Parallel Micro-Gripper', 'Mechanical', 245.00, 580, 100, '2026-01-18 09:15:00'),
    (5, 3, 'SENS-LIDAR-360', 'Solid-State LiDAR Scanner 200m', 'Electronics', 890.00, 210, 40, '2026-01-20 16:45:00'),
    (6, 3, 'SENS-IMU-6DOF', 'Industrial 6-DoF Inertial Unit', 'Electronics', 45.00, 3400, 500, '2026-01-22 10:20:00'),
    (7, 4, 'OPTO-LASER-850', '850nm VCSEL Transceiver Module', 'Electronics', 115.00, 1800, 250, '2026-01-25 13:00:00'),
    (8, 5, 'RAW-CF-PANEL', 'Carbon Fiber Composite Panel 4mm', 'Raw Materials', 310.00, 650, 120, '2026-02-01 11:10:00'),
    (9, 6, 'MECH-BEARING-70', 'Ceramic High-Speed Spindle Bearing', 'Mechanical', 88.00, 2200, 400, '2026-02-05 15:30:00'),
    (10, 7, 'THERM-PIPE-012', 'Sintered Copper Heat Pipe Array', 'Mechanical', 34.50, 4100, 800, '2026-02-08 09:50:00'),
    (11, 8, 'CONN-USB4-GEN3', 'Gold-Plated Rugged USB4 Receptacle', 'Electronics', 4.80, 25000, 5000, '2026-02-12 14:15:00'),
    (12, 9, 'PWR-MOSFET-120', 'Silicon Carbide SiC MOSFET 1200V', 'Electronics', 28.00, 8500, 1500, '2026-02-15 10:00:00')
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO shipments (id, supplier_id, tracking_number, origin_country, destination_country, carrier, status, freight_cost, weight_kg, shipped_at, delivered_at) VALUES
    (1, 1, 'TRK-DHL-9001', 'Taiwan', 'USA', 'DHL Express', 'DELIVERED', 1450.00, 120.50, '2026-01-05 10:00:00', '2026-01-08 16:30:00'),
    (2, 2, 'TRK-FDX-9002', 'Germany', 'USA', 'FedEx Freight', 'DELIVERED', 2800.00, 450.00, '2026-01-08 14:00:00', '2026-01-13 11:15:00'),
    (3, 3, 'TRK-DHL-9003', 'Japan', 'Germany', 'DHL Express', 'DELIVERED', 980.00, 65.00, '2026-01-12 09:30:00', '2026-01-15 15:00:00'),
    (4, 4, 'TRK-MSK-9004', 'South Korea', 'USA', 'Maersk', 'DELIVERED', 4200.00, 1850.00, '2026-01-15 08:00:00', '2026-02-01 10:00:00'),
    (5, 5, 'TRK-UPS-9005', 'Switzerland', 'USA', 'UPS Air', 'DELIVERED', 1650.00, 210.00, '2026-01-20 11:45:00', '2026-01-24 14:20:00'),
    (6, 1, 'TRK-DHL-9006', 'Taiwan', 'Germany', 'DHL Express', 'DELIVERED', 1890.00, 160.00, '2026-01-25 15:30:00', '2026-01-29 17:00:00'),
    (7, 2, 'TRK-FDX-9007', 'Germany', 'Singapore', 'FedEx Freight', 'IN_TRANSIT', 3100.00, 520.00, '2026-02-01 13:00:00', NULL),
    (8, 3, 'TRK-DHL-9008', 'Japan', 'USA', 'DHL Express', 'IN_TRANSIT', 1250.00, 85.00, '2026-02-03 10:15:00', NULL),
    (9, 6, 'TRK-UPS-9009', 'USA', 'Germany', 'UPS Air', 'CUSTOMS_HOLD', 1400.00, 310.00, '2026-02-04 16:45:00', NULL),
    (10, 9, 'TRK-DHL-9010', 'Germany', 'USA', 'DHL Express', 'IN_TRANSIT', 2150.00, 280.00, '2026-02-06 09:00:00', NULL)
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO shipment_events (id, shipment_id, event_type, event_time, location, notes) VALUES
    (1, 1, 'DEPARTED', '2026-01-05 10:30:00', 'Taipei Taoyuan International Airport', 'Flight cargo loaded'),
    (2, 1, 'ARRIVED_HUB', '2026-01-06 18:00:00', 'Cincinnati Northern Kentucky Hub', 'Transferred to sorting facility'),
    (3, 1, 'CLEARED_CUSTOMS', '2026-01-07 08:30:00', 'Cincinnati, OH, USA', 'Import duty cleared'),
    (4, 1, 'DELIVERED', '2026-01-08 16:30:00', 'San Jose, CA, USA', 'Signed by receiving dock'),
    (5, 7, 'DEPARTED', '2026-02-01 13:30:00', 'Frankfurt Cargo City South', 'Scheduled flight departure'),
    (6, 7, 'ARRIVED_HUB', '2026-02-02 22:00:00', 'Dubai International Airport', 'In transit intermediate stop'),
    (7, 9, 'DEPARTED', '2026-02-04 17:00:00', 'Chicago O Hare International', 'Air cargo en route to Frankfurt'),
    (8, 9, 'ARRIVED_HUB', '2026-02-05 09:00:00', 'Frankfurt Airport Hub', 'Awaiting customs documentation review')
ON DUPLICATE KEY UPDATE id=id;

-- -----------------------------------------------------------------------------
-- 5. Dedicated Least-Privilege Read-Only User
-- -----------------------------------------------------------------------------
-- This user is granted ONLY SELECT on the demo database.
-- It CANNOT perform INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or GRANT.
CREATE USER IF NOT EXISTS 'metriva_readonly'@'%' IDENTIFIED BY 'readonly_secure_pass';
GRANT SELECT ON metriva_mysql_demo.* TO 'metriva_readonly'@'%';
FLUSH PRIVILEGES;

