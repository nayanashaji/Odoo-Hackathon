/**
 * seed.js
 * Database Seed Script for Brightloop Subscription System
 * Populates 5 dummy products conforming to docs/schema.json contract
 *
 * Usage:
 *   node seed.js
 */

const path = require('path');
const fs = require('fs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brightloop_odoo';

// 5 Dummy Products conforming to docs/schema.json data contract
const dummyProducts = [
  {
    id: 'prod_1',
    name: 'Enterprise Dedicated Cloud Server',
    description: 'High-availability dedicated compute server with ECC memory, NVMe arrays, and hardware RAID.',
    category: 'Infrastructure',
    sales_price: 1200,
    cost_price: 200,
    status: 'active',
    variants: [
      {
        id: 'var_1',
        name: 'Brand: Dell PowerEdge R750',
        attribute: 'brand',
        value: 'Dell',
        price_modifier: 560, // Exactly as in docs/schema.json -> 1200 + 560 = 1760
        cost_modifier: 90,
        sku: 'SRV-DELL-R750',
        in_stock: true
      },
      {
        id: 'var_2',
        name: 'Brand: HPE ProLiant DL380 Gen10',
        attribute: 'brand',
        value: 'HPE',
        price_modifier: 620, // 1200 + 620 = 1820
        cost_modifier: 110,
        sku: 'SRV-HPE-DL380',
        in_stock: true
      },
      {
        id: 'var_3',
        name: 'Brand: Supermicro Ultra SuperServer',
        attribute: 'brand',
        value: 'Supermicro',
        price_modifier: 380, // 1200 + 380 = 1580
        cost_modifier: 60,
        sku: 'SRV-SMC-1029',
        in_stock: true
      }
    ]
  },
  {
    id: 'prod_2',
    name: 'Carrier-Grade 10G Security Gateway',
    description: 'Hardware firewall and SD-WAN gateway capable of 10 Gbps multi-threat inspection throughput.',
    category: 'Networking',
    sales_price: 450,
    cost_price: 120,
    status: 'active',
    variants: [
      {
        id: 'var_4',
        name: 'Brand: Cisco Catalyst Edge',
        attribute: 'brand',
        value: 'Cisco',
        price_modifier: 280, // 450 + 280 = 730
        cost_modifier: 50,
        sku: 'NET-CSCO-8300',
        in_stock: true
      },
      {
        id: 'var_5',
        name: 'Brand: Juniper Networks SRX345',
        attribute: 'brand',
        value: 'Juniper',
        price_modifier: 240, // 450 + 240 = 690
        cost_modifier: 45,
        sku: 'NET-JNPR-345',
        in_stock: true
      },
      {
        id: 'var_6',
        name: 'Brand: Ubiquiti UniFi Dream Machine Pro',
        attribute: 'brand',
        value: 'Ubiquiti',
        price_modifier: 120, // 450 + 120 = 570
        cost_modifier: 25,
        sku: 'NET-UBNT-UDM',
        in_stock: true
      }
    ]
  },
  {
    id: 'prod_3',
    name: 'Smart Retail Touch POS Terminal',
    description: 'Compact high-speed Point of Sale terminal with integrated capacitive screen and high-speed thermal printer.',
    category: 'Hardware',
    sales_price: 850,
    cost_price: 300,
    status: 'active',
    variants: [
      {
        id: 'var_7',
        name: 'Brand: Elo Touch Solutions I-Series',
        attribute: 'brand',
        value: 'Elo',
        price_modifier: 220, // 850 + 220 = 1070
        cost_modifier: 40,
        sku: 'POS-ELO-I15',
        in_stock: true
      },
      {
        id: 'var_8',
        name: 'Brand: HP Engage One Pro',
        attribute: 'brand',
        value: 'HP',
        price_modifier: 310, // 850 + 310 = 1160
        cost_modifier: 55,
        sku: 'POS-HP-E1',
        in_stock: true
      },
      {
        id: 'var_9',
        name: 'Brand: Sunmi T2s Dual Display',
        attribute: 'brand',
        value: 'Sunmi',
        price_modifier: 140, // 850 + 140 = 990
        cost_modifier: 30,
        sku: 'POS-SNM-T2S',
        in_stock: true
      }
    ]
  },
  {
    id: 'prod_4',
    name: 'Odoo Enterprise Suite SaaS License',
    description: 'Comprehensive ERP cloud software package: CRM, Subscriptions, Sales, Invoicing, and Auto-Accounting.',
    category: 'Software & SaaS',
    sales_price: 650,
    cost_price: 60,
    status: 'active',
    variants: [
      {
        id: 'var_10',
        name: 'Tier: Premium 24/7 SLA & DevOps',
        attribute: 'tier',
        value: 'Enterprise Platinum',
        price_modifier: 450, // 650 + 450 = 1100
        cost_modifier: 30,
        sku: 'SAS-PLAT-247',
        in_stock: true
      },
      {
        id: 'var_11',
        name: 'Tier: Dedicated Account Engineer',
        attribute: 'tier',
        value: 'Gold Priority',
        price_modifier: 250, // 650 + 250 = 900
        cost_modifier: 15,
        sku: 'SAS-GOLD-PRI',
        in_stock: true
      }
    ]
  },
  {
    id: 'prod_5',
    name: 'Industrial Edge AI Accelerator Box',
    description: 'Rugged fanless embedded AI box for real-time video telemetry, defect detection, and warehouse automation.',
    category: 'AI Hardware',
    sales_price: 2100,
    cost_price: 750,
    status: 'active',
    variants: [
      {
        id: 'var_12',
        name: 'Brand: NVIDIA Jetson AGX Orin 64GB',
        attribute: 'brand',
        value: 'NVIDIA',
        price_modifier: 890, // 2100 + 890 = 2990
        cost_modifier: 140,
        sku: 'AI-NVDA-AGX64',
        in_stock: true
      },
      {
        id: 'var_13',
        name: 'Brand: Intel Xeon Edge VPU Unit',
        attribute: 'brand',
        value: 'Intel',
        price_modifier: 480, // 2100 + 480 = 2580
        cost_modifier: 80,
        sku: 'AI-INTL-VPU',
        in_stock: true
      }
    ]
  }
];

async function seedDatabase() {
  console.log('🌱 Starting Brightloop Product Catalog Seeder...\n');

  // 1. Always save offline JSON snapshot so tests, frontend, and offline dev never break
  const dataDir = path.join(__dirname, 'backend', 'src', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const jsonPath = path.join(dataDir, 'products.json');
  fs.writeFileSync(jsonPath, JSON.stringify(dummyProducts, null, 2), 'utf-8');
  console.log(`📁 Saved offline JSON snapshot to ${jsonPath}`);

  // 2. Check if mongoose can be loaded
  let mongoose;
  try {
    mongoose = require('mongoose');
  } catch (e) {
    try {
      mongoose = require(path.join(__dirname, 'backend', 'node_modules', 'mongoose'));
    } catch (e2) {
      console.log('\n================ SEED DATA PREPARED ================');
      dummyProducts.forEach((p, idx) => {
        console.log(`[#${idx + 1}] ${p.id.padEnd(8)} | ${p.name.padEnd(35)} | Base: $${p.sales_price} | Cost: $${p.cost_price}`);
        p.variants.forEach((v) => {
          const finalPrice = p.sales_price + v.price_modifier;
          console.log(`    ↳ Variant [${v.id}]: ${v.name} (+${v.price_modifier}) => Final: $${finalPrice}`);
        });
      });
      console.log('=====================================================');
      console.log(`\n✅ 5 dummy products saved to ${jsonPath}`);
      console.log(`ℹ️  To sync directly into MongoDB, run 'npm install' in backend/ and re-run this script.`);
      process.exit(0);
      return;
    }
  }

  // 3. Connect to MongoDB if mongoose is available
  try {
    const Product = require('./backend/src/models/Product');

    console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    console.log('Connected to MongoDB successfully.');

    console.log('Clearing existing product catalog...');
    await Product.deleteMany({});

    console.log('Inserting 5 dummy products...');
    const created = await Product.insertMany(dummyProducts);

    console.log('\n================ SEED SUCCESSFUL ================');
    created.forEach((p, idx) => {
      console.log(`[#${idx + 1}] ${p.id.padEnd(8)} | ${p.name.padEnd(35)} | Base: $${p.sales_price} | Cost: $${p.cost_price}`);
      p.variants.forEach((v) => {
        const finalPrice = p.sales_price + v.price_modifier;
        console.log(`    ↳ Variant [${v.id}]: ${v.name} (+${v.price_modifier}) => Final: $${finalPrice}`);
      });
    });
    console.log('=================================================\n');

    await mongoose.disconnect();
    console.log('MongoDB connection closed cleanly.');
    process.exit(0);
  } catch (err) {
    console.warn(`\n⚠️  MongoDB direct insert skipped (${err.message}).`);
    console.log(`✅ 5 dummy products are active and stored in ${jsonPath}`);
    process.exit(0);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { dummyProducts, seedDatabase };
