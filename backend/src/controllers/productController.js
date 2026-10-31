const Product = require('../models/Product');
const { Plan } = require('../models/Plan');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');

// Check if MongoDB is connected and ready
const isDbConnected = () => {
  return mongoose && mongoose.connection && mongoose.connection.readyState === 1;
};

// Helper to normalize query whether using custom 'id' or MongoDB '_id'
const buildIdFilter = (id) => {
  return { id: id };
};

// Fallback file helpers
const readLocalProducts = () => {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return [];
};

const writeLocalProducts = (products) => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
  } catch (e) {}
};

const readLocalPlans = () => {
  try {
    if (fs.existsSync(PLANS_FILE)) {
      return JSON.parse(fs.readFileSync(PLANS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return [];
};

/**
 * Helper to populate nested plans for a product
 */
const populateProductPlans = async (prod) => {
  const productObj = typeof prod.toObject === 'function' ? prod.toObject({ virtuals: true }) : { ...prod };
  const planIds = Array.isArray(productObj.plans) ? productObj.plans : [];

  let nestedPlans = [];

  // 1. If MongoDB is actively connected
  if (isDbConnected()) {
    try {
      const foundPlans = await Plan.find({
        $or: [
          { id: { $in: planIds } },
          { product_id: productObj.id }
        ]
      });
      if (foundPlans && foundPlans.length > 0) {
        nestedPlans = foundPlans.map((p) => (typeof p.toObject === 'function' ? p.toObject({ virtuals: true }) : p));
      }
    } catch (e) {}
  }

  // 2. Fallback to local plans.json
  if (nestedPlans.length === 0) {
    const allPlans = readLocalPlans();
    nestedPlans = allPlans.filter(
      (p) => planIds.includes(p.id) || p.product_id === productObj.id
    );
  }

  productObj.plans = nestedPlans;
  return productObj;
};

/**
 * 1. GET /api/products
 * Fetch all products with populated nested Plan data for each product
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { search, category, status } = req.query;
    let productsList = [];

    if (isDbConnected()) {
      try {
        const filter = {};
        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { id: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ];
        }
        if (category && category !== 'all') {
          filter.category = category;
        }
        if (status) {
          filter.status = status;
        }

        const products = await Product.find(filter).sort({ createdAt: -1 });
        if (products && products.length > 0) {
          productsList = products;
        }
      } catch (dbErr) {}
    }

    // Fallback to local file store if DB empty or offline
    if (productsList.length === 0) {
      productsList = readLocalProducts();
      if (category && category !== 'all') {
        productsList = productsList.filter((p) => p.category === category);
      }
      if (status) {
        productsList = productsList.filter((p) => p.status === status);
      }
      if (search) {
        const q = search.toLowerCase();
        productsList = productsList.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
        );
      }
    }

    // Populate nested plans and compute dynamic price ranges
    const formatted = await Promise.all(
      productsList.map(async (prod) => {
        const populated = await populateProductPlans(prod);
        const modifiers = (populated.variants || []).map((v) => Number(v.price_modifier) || 0);
        const minModifier = modifiers.length > 0 ? Math.min(...modifiers, 0) : 0;
        const maxModifier = modifiers.length > 0 ? Math.max(...modifiers, 0) : 0;

        populated.price_range = {
          min: populated.sales_price + minModifier,
          max: populated.sales_price + maxModifier
        };
        return populated;
      })
    );

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: error.message
    });
  }
};

/**
 * 2. GET /api/products/:id
 * Fetch a single product by custom id with populated nested plans
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    let foundProd = null;

    if (isDbConnected()) {
      try {
        foundProd = await Product.findOne(buildIdFilter(id));
      } catch (e) {}
    }

    if (!foundProd) {
      const local = readLocalProducts();
      foundProd = local.find((p) => p.id === id);
    }

    if (!foundProd) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    const populated = await populateProductPlans(foundProd);

    return res.status(200).json({
      success: true,
      data: populated
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve product',
      error: error.message
    });
  }
};

/**
 * 3. POST /api/products
 * Create a new product with optional initial variants & plans
 */
exports.createProduct = async (req, res) => {
  try {
    const {
      id,
      name,
      description,
      category,
      sales_price,
      cost_price,
      variants,
      plans,
      status
    } = req.body;

    if (!name || sales_price === undefined || cost_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, sales_price, and cost_price are required fields.'
      });
    }

    const productId = id || `prod_${Date.now()}`;

    const formattedVariants = Array.isArray(variants)
      ? variants.map((v, idx) => ({
          id: v.id || `var_${productId}_${idx + 1}`,
          name: v.name || `${v.attribute || 'Variant'}: ${v.value || 'Default'}`,
          attribute: v.attribute || 'brand',
          value: v.value || 'Standard',
          price_modifier: Number(v.price_modifier) || 0,
          cost_modifier: Number(v.cost_modifier) || 0,
          sku: v.sku || '',
          in_stock: v.in_stock !== false
        }))
      : [];

    const newProductData = {
      id: productId,
      name,
      description: description || '',
      category: category || 'General',
      sales_price: Number(sales_price),
      cost_price: Number(cost_price),
      status: status || 'active',
      variants: formattedVariants,
      plans: Array.isArray(plans) ? plans : []
    };

    if (isDbConnected()) {
      try {
        const newProduct = new Product(newProductData);
        const saved = await newProduct.save();
        const populated = await populateProductPlans(saved);
        return res.status(201).json({
          success: true,
          message: 'Product created successfully',
          data: populated
        });
      } catch (e) {}
    }

    const local = readLocalProducts();
    local.unshift(newProductData);
    writeLocalProducts(local);
    const populated = await populateProductPlans(newProductData);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully (Local Store)',
      data: populated
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

/**
 * 4. PUT /api/products/:id
 * Update an existing product
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates._id;
    delete updates.id;

    if (updates.sales_price !== undefined) updates.sales_price = Number(updates.sales_price);
    if (updates.cost_price !== undefined) updates.cost_price = Number(updates.cost_price);

    if (isDbConnected()) {
      try {
        const updatedProduct = await Product.findOneAndUpdate(
          buildIdFilter(id),
          { $set: updates },
          { new: true, runValidators: true }
        );
        if (updatedProduct) {
          const populated = await populateProductPlans(updatedProduct);
          return res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            data: populated
          });
        }
      } catch (e) {}
    }

    const local = readLocalProducts();
    const idx = local.findIndex((p) => p.id === id);
    if (idx === -1) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    local[idx] = { ...local[idx], ...updates };
    writeLocalProducts(local);
    const populated = await populateProductPlans(local[idx]);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully (Local Store)',
      data: populated
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  }
};

/**
 * 5. DELETE /api/products/:id
 * Delete a product by ID
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (isDbConnected()) {
      try {
        const deleted = await Product.findOneAndDelete(buildIdFilter(id));
        if (deleted) {
          return res.status(200).json({
            success: true,
            message: `Product '${id}' deleted successfully.`,
            data: { id: deleted.id, name: deleted.name }
          });
        }
      } catch (e) {}
    }

    const local = readLocalProducts();
    const filtered = local.filter((p) => p.id !== id);
    writeLocalProducts(filtered);

    return res.status(200).json({
      success: true,
      message: `Product '${id}' deleted successfully.`
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  }
};

/**
 * 6. POST /api/products/:id/variants
 * Dynamically add a product variant (e.g. Brand) with a price modifier (+560)
 */
exports.addVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, attribute, value, price_modifier, cost_modifier, sku } = req.body;

    if (!value || price_modifier === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Variant value and price_modifier are required.'
      });
    }

    let product = null;
    if (isDbConnected()) {
      try {
        product = await Product.findOne(buildIdFilter(id));
      } catch (e) {}
    }

    let isLocal = false;
    if (!product) {
      const local = readLocalProducts();
      product = local.find((p) => p.id === id);
      isLocal = true;
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    const variantId = `var_${product.id}_${(product.variants || []).length + 1}`;
    const variantName = name || `${attribute || 'Brand'}: ${value}`;

    const newVariant = {
      id: variantId,
      name: variantName,
      attribute: attribute || 'brand',
      value: value,
      price_modifier: Number(price_modifier) || 0,
      cost_modifier: Number(cost_modifier) || 0,
      sku: sku || `${product.id}-${value.toUpperCase()}`,
      in_stock: true
    };

    if (isLocal) {
      const local = readLocalProducts();
      const pIdx = local.findIndex((p) => p.id === id);
      local[pIdx].variants = local[pIdx].variants || [];
      local[pIdx].variants.push(newVariant);
      writeLocalProducts(local);
      const populated = await populateProductPlans(local[pIdx]);
      return res.status(201).json({
        success: true,
        message: `Variant '${newVariant.name}' added with modifier +$${newVariant.price_modifier}`,
        data: populated
      });
    }

    product.variants.push(newVariant);
    await product.save();
    const populated = await populateProductPlans(product);

    return res.status(201).json({
      success: true,
      message: `Variant '${newVariant.name}' added with modifier +$${newVariant.price_modifier}`,
      data: populated
    });
  } catch (error) {
    console.error('Error adding variant:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to add variant',
      error: error.message
    });
  }
};

/**
 * 7. DELETE /api/products/:id/variants/:variantId
 * Remove a variant from a product
 */
exports.deleteVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;

    let product = null;
    if (isDbConnected()) {
      try {
        product = await Product.findOne(buildIdFilter(id));
      } catch (e) {}
    }

    let isLocal = false;
    if (!product) {
      const local = readLocalProducts();
      product = local.find((p) => p.id === id);
      isLocal = true;
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    if (isLocal) {
      const local = readLocalProducts();
      const pIdx = local.findIndex((p) => p.id === id);
      local[pIdx].variants = (local[pIdx].variants || []).filter((v) => v.id !== variantId);
      writeLocalProducts(local);
      const populated = await populateProductPlans(local[pIdx]);
      return res.status(200).json({
        success: true,
        message: `Variant '${variantId}' removed successfully`,
        data: populated
      });
    }

    product.variants = product.variants.filter((v) => v.id !== variantId);
    await product.save();
    const populated = await populateProductPlans(product);

    return res.status(200).json({
      success: true,
      message: `Variant '${variantId}' removed successfully`,
      data: populated
    });
  } catch (error) {
    console.error('Error removing variant:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete variant',
      error: error.message
    });
  }
};

/**
 * 8. POST /api/products/:id/plans
 * Explicitly link a Plan to a Product
 */
exports.linkPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'planId is required in request body.'
      });
    }

    if (isDbConnected()) {
      try {
        await Product.findOneAndUpdate(
          buildIdFilter(id),
          { $addToSet: { plans: planId } },
          { new: true }
        );
        await Plan.findOneAndUpdate(
          { id: planId },
          { $set: { product_id: id } }
        );
      } catch (e) {}
    }

    // Local file store sync
    const localProds = readLocalProducts();
    const pIdx = localProds.findIndex((p) => p.id === id);
    if (pIdx !== -1) {
      localProds[pIdx].plans = localProds[pIdx].plans || [];
      if (!localProds[pIdx].plans.includes(planId)) {
        localProds[pIdx].plans.push(planId);
      }
      writeLocalProducts(localProds);
    }

    const localPlans = readLocalPlans();
    const plIdx = localPlans.findIndex((p) => p.id === planId);
    if (plIdx !== -1) {
      localPlans[plIdx].product_id = id;
      writeLocalPlans(localPlans);
    }

    let targetProd = null;
    if (isDbConnected()) {
      try {
        targetProd = await Product.findOne(buildIdFilter(id));
      } catch (e) {}
    }
    if (!targetProd && pIdx !== -1) {
      targetProd = localProds[pIdx];
    }

    const populated = await populateProductPlans(targetProd);

    return res.status(200).json({
      success: true,
      message: `Plan '${planId}' linked to Product '${id}' successfully.`,
      data: populated
    });
  } catch (error) {
    console.error('Error linking plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link plan to product',
      error: error.message
    });
  }
};

/**
 * 9. GET /api/products/:id/calculate-price
 * Dynamically compute final price: base_sales_price + variant.price_modifier
 */
exports.calculatePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { variantId } = req.query;

    let product = null;
    if (isDbConnected()) {
      try {
        product = await Product.findOne(buildIdFilter(id));
      } catch (e) {}
    }

    if (!product) {
      const local = readLocalProducts();
      product = local.find((p) => p.id === id);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    const variant = (product.variants || []).find((v) => v.id === variantId);
    const modifier = variant ? Number(variant.price_modifier) || 0 : 0;
    const finalPrice = Number((product.sales_price + modifier).toFixed(2));

    return res.status(200).json({
      success: true,
      product_id: product.id,
      product_name: product.name,
      base_sales_price: product.sales_price,
      variant_id: variant ? variant.id : null,
      variant_name: variant ? variant.name : null,
      price_modifier: modifier,
      final_sales_price: finalPrice
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
