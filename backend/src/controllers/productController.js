const Product = require('../models/Product');

/**
 * Helper to normalize query whether using custom 'id' or MongoDB '_id'
 */
const buildIdFilter = (id) => {
  return { id: id };
};

/**
 * 1. GET /api/products
 * Fetch all products with optional search and category filters
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { search, category, status } = req.query;
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

    // Format output with computed price range per product
    const formatted = products.map((prod) => {
      const obj = prod.toObject({ virtuals: true });
      const modifiers = (prod.variants || []).map((v) => Number(v.price_modifier) || 0);
      const minModifier = modifiers.length > 0 ? Math.min(...modifiers, 0) : 0;
      const maxModifier = modifiers.length > 0 ? Math.max(...modifiers, 0) : 0;

      obj.price_range = {
        min: prod.sales_price + minModifier,
        max: prod.sales_price + maxModifier
      };
      return obj;
    });

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
 * Fetch a single product by custom id (e.g. "prod_1") or _id
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne(buildIdFilter(id));

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: product
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
 * Create a new product with optional initial variants
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
      status
    } = req.body;

    if (!name || sales_price === undefined || cost_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, sales_price, and cost_price are required fields.'
      });
    }

    // Auto-generate product ID if not provided
    const productId = id || `prod_${Date.now()}`;

    // Validate and format variants if provided
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

    const newProduct = new Product({
      id: productId,
      name,
      description: description || '',
      category: category || 'General',
      sales_price: Number(sales_price),
      cost_price: Number(cost_price),
      status: status || 'active',
      variants: formattedVariants
    });

    const savedProduct = await newProduct.save();

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: savedProduct
    });
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `Product with ID '${req.body.id}' already exists.`
      });
    }
    return res.status(400).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

/**
 * 4. PUT /api/products/:id
 * Update an existing product and its variants
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Disallow overriding immutable primary ID
    delete updates._id;
    delete updates.id;

    if (updates.sales_price !== undefined) updates.sales_price = Number(updates.sales_price);
    if (updates.cost_price !== undefined) updates.cost_price = Number(updates.cost_price);

    const updatedProduct = await Product.findOneAndUpdate(
      buildIdFilter(id),
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
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
    const deleted = await Product.findOneAndDelete(buildIdFilter(id));

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      message: `Product '${id}' deleted successfully`,
      data: { id: deleted.id, name: deleted.name }
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

    const product = await Product.findOne(buildIdFilter(id));
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    const variantId = `var_${product.id}_${product.variants.length + 1}`;
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

    product.variants.push(newVariant);
    await product.save();

    const calculation = product.calculateVariantPrice(variantId);

    return res.status(201).json({
      success: true,
      message: `Variant '${newVariant.name}' added with modifier +$${newVariant.price_modifier}`,
      data: product,
      pricing_preview: calculation
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

    const product = await Product.findOne(buildIdFilter(id));
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    const initialLength = product.variants.length;
    product.variants = product.variants.filter((v) => v.id !== variantId);

    if (product.variants.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: `Variant with ID '${variantId}' not found on product '${id}'`
      });
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: `Variant '${variantId}' removed successfully`,
      data: product
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
 * 8. GET /api/products/:id/calculate-price
 * Dynamically compute final price: base_sales_price + variant.price_modifier
 * Query params: ?variantId=var_1
 */
exports.calculatePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { variantId } = req.query;

    const product = await Product.findOne(buildIdFilter(id));
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    const priceDetails = product.calculateVariantPrice(variantId);

    return res.status(200).json({
      success: true,
      product_id: product.id,
      product_name: product.name,
      ...priceDetails
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message
    });
  }
};
