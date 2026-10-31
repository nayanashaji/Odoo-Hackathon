const Product = require('../models/Product');
const { Plan } = require('../models/Plan');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');

// Check if MongoDB connection is established and ready
const isDbConnected = () => {
  return mongoose && mongoose.connection && mongoose.connection.readyState === 1;
};

// In-Memory Micro-Cache for ultra-fast quotation queries (< 2ms)
let catalogCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10 seconds cache TTL

// Helper to read local files in fallback mode
const readLocalJson = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return [];
};

/**
 * GET /api/internal/catalog
 *
 * Consolidates all active products, their variants, and associated plans
 * for the Sales Quotation System.
 *
 * Performance Optimizations:
 * 1. Single MongoDB Aggregation Pipeline ($lookup + $project) bypassing N+1 queries
 * 2. Database level status indexing & projection to minimize network wire payload
 * 3. Lean execution (no Mongoose document hydration overhead)
 * 4. In-memory micro-cache with TTL
 * 5. High-speed O(1) indexed Map linking in fallback file mode
 */
exports.getConsolidatedCatalog = async (req, res) => {
  const startTime = process.hrtime.bigint();

  try {
    // 1. Check in-memory micro-cache
    const now = Date.now();
    if (catalogCache && now - lastCacheTime < CACHE_TTL_MS && !req.query.nocache) {
      const endTime = process.hrtime.bigint();
      const responseTimeMs = Number((endTime - startTime) / 1000000n);

      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Response-Time-ms', responseTimeMs);
      return res.status(200).json({
        success: true,
        source: 'cache',
        execution_time_ms: responseTimeMs,
        count: catalogCache.length,
        data: catalogCache
      });
    }

    let consolidated = [];

    // 2. Optimized MongoDB Aggregation Path (Runs in a single query)
    if (isDbConnected()) {
      try {
        consolidated = await Product.aggregate([
          // Step 1: Filter active products using index
          {
            $match: {
              status: 'active'
            }
          },
          // Step 2: Single $lookup join for associated active plans
          {
            $lookup: {
              from: 'plans',
              let: { prodId: '$id', prodPlans: { $ifNull: ['$plans', []] } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ['$status', 'active'] },
                        {
                          $or: [
                            { $in: ['$id', '$$prodPlans'] },
                            { $eq: ['$product_id', '$$prodId'] }
                          ]
                        }
                      ]
                    }
                  }
                },
                {
                  $project: {
                    _id: 0,
                    id: 1,
                    product_id: 1,
                    name: 1,
                    code: 1,
                    description: 1,
                    billing_frequency: 1,
                    minimum_quantity: 1,
                    closing_behavior: 1,
                    available_from: 1,
                    available_until: 1,
                    base_price: 1,
                    status: 1
                  }
                }
              ],
              as: 'plans'
            }
          },
          // Step 3: Project clean quotation schema
          {
            $project: {
              _id: 0,
              id: 1,
              name: 1,
              code: 1,
              category: 1,
              description: 1,
              sales_price: 1,
              cost_price: 1,
              status: 1,
              variants: {
                $map: {
                  input: { $ifNull: ['$variants', []] },
                  as: 'v',
                  in: {
                    id: '$$v.id',
                    name: '$$v.name',
                    attribute: '$$v.attribute',
                    value: '$$v.value',
                    price_modifier: '$$v.price_modifier',
                    calculated_sales_price: {
                      $add: ['$sales_price', { $ifNull: ['$$v.price_modifier', 0] }]
                    },
                    sku: '$$v.sku',
                    in_stock: '$$v.in_stock'
                  }
                }
              },
              plans: 1
            }
          },
          // Step 4: Sort by product ID
          {
            $sort: { id: 1 }
          }
        ]).exec();
      } catch (dbErr) {
        console.warn('MongoDB aggregate error, falling back to local files:', dbErr.message);
      }
    }

    // 3. Fallback High-Speed File Indexing Path (O(N+M) complexity)
    if (!consolidated || consolidated.length === 0) {
      const allProducts = readLocalJson(PRODUCTS_FILE);
      const allPlans = readLocalJson(PLANS_FILE);

      // Filter only active items
      const activeProducts = allProducts.filter((p) => p.status === 'active' || !p.status);
      const activePlans = allPlans.filter((pl) => pl.status === 'active' || !pl.status);

      // Build indexing maps for O(1) plan lookup
      const plansByIdMap = new Map();
      const plansByProductIdMap = new Map();

      activePlans.forEach((plan) => {
        plansByIdMap.set(plan.id, plan);
        if (plan.product_id) {
          if (!plansByProductIdMap.has(plan.product_id)) {
            plansByProductIdMap.set(plan.product_id, []);
          }
          plansByProductIdMap.get(plan.product_id).push(plan);
        }
      });

      // Assemble consolidated records
      consolidated = activeProducts.map((prod) => {
        const prodPlanIds = Array.isArray(prod.plans) ? prod.plans : [];

        // Match plans by reference or by product_id
        const matchedPlansMap = new Map();

        // 1. By ID array
        prodPlanIds.forEach((id) => {
          if (plansByIdMap.has(id)) {
            matchedPlansMap.set(id, plansByIdMap.get(id));
          }
        });

        // 2. By product_id backlink
        if (plansByProductIdMap.has(prod.id)) {
          plansByProductIdMap.get(prod.id).forEach((plan) => {
            matchedPlansMap.set(plan.id, plan);
          });
        }

        // Compute variant sales prices
        const enrichedVariants = (prod.variants || []).map((v) => ({
          id: v.id,
          name: v.name,
          attribute: v.attribute,
          value: v.value,
          price_modifier: Number(v.price_modifier) || 0,
          calculated_sales_price: Number((prod.sales_price + (Number(v.price_modifier) || 0)).toFixed(2)),
          sku: v.sku || '',
          in_stock: v.in_stock !== false
        }));

        return {
          id: prod.id,
          name: prod.name,
          category: prod.category || 'General',
          description: prod.description || '',
          sales_price: Number(prod.sales_price) || 0,
          cost_price: Number(prod.cost_price) || 0,
          status: prod.status || 'active',
          variants: enrichedVariants,
          plans: Array.from(matchedPlansMap.values()).map((pl) => ({
            id: pl.id,
            product_id: pl.product_id || prod.id,
            name: pl.name,
            code: pl.code || '',
            description: pl.description || '',
            billing_frequency: pl.billing_frequency,
            minimum_quantity: Number(pl.minimum_quantity) || 1,
            closing_behavior: pl.closing_behavior,
            available_from: pl.available_from,
            available_until: pl.available_until,
            base_price: Number(pl.base_price) || 0,
            status: pl.status || 'active'
          }))
        };
      });
    }

    // 4. Update Micro-Cache
    catalogCache = consolidated;
    lastCacheTime = Date.now();

    const endTime = process.hrtime.bigint();
    const responseTimeMs = Number((endTime - startTime) / 1000000n);

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Response-Time-ms', responseTimeMs);

    return res.status(200).json({
      success: true,
      source: isDbConnected() ? 'database_aggregate' : 'local_store_indexed',
      execution_time_ms: responseTimeMs,
      count: consolidated.length,
      data: consolidated
    });
  } catch (error) {
    console.error('Error generating internal catalog:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate internal catalog',
      error: error.message
    });
  }
};
