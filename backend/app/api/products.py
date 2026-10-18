from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from app import db
from app.models import Product

products_bp = Blueprint("products", __name__, url_prefix="/api/products")


@products_bp.get("/")
def list_products():
    products = Product.query.order_by(Product.id.asc()).all()

    return jsonify({
        "count": len(products),
        "products": [
            {
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "sku": product.sku,
                "price": float(product.price),
                "stock_quantity": product.stock_quantity,
                "is_active": product.is_active,
            }
            for product in products
        ],
    }), 200


@products_bp.get("/<int:product_id>")
def get_product(product_id):
    product = db.session.get(Product, product_id)

    if product is None:
        return jsonify({"error": "Product not found"}), 404

    return jsonify({
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "sku": product.sku,
        "price": float(product.price),
        "stock_quantity": product.stock_quantity,
        "is_active": product.is_active,
    }), 200


@products_bp.post("/")
def create_product():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    name = data.get("name")
    sku = data.get("sku")
    price = data.get("price")
    stock = data.get("stock_quantity", 0)

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Product name is required"}), 400

    if not isinstance(sku, str) or not sku.strip():
        return jsonify({"error": "Product SKU is required"}), 400

    if isinstance(price, bool) or not isinstance(price, (int, float)):
        return jsonify({"error": "Price must be a number"}), 400

    if price < 0:
        return jsonify({"error": "Price cannot be negative"}), 400

    if isinstance(stock, bool) or not isinstance(stock, int) or stock < 0:
        return jsonify({"error": "Stock must be a non-negative integer"}), 400

    product = Product(
        name=name.strip(),
        description=data.get("description"),
        sku=sku.strip(),
        price=price,
        stock_quantity=stock,
        is_active=True,
    )

    try:
        db.session.add(product)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "A product with this SKU may already exist"}), 409

    return jsonify({
        "message": "Product created successfully",
        "product": {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "price": float(product.price),
            "stock_quantity": product.stock_quantity,
        },
    }), 201


@products_bp.patch("/<int:product_id>")
def update_product(product_id):
    product = db.session.get(Product, product_id)

    if product is None:
        return jsonify({"error": "Product not found"}), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    if "name" in data:
        if not isinstance(data["name"], str) or not data["name"].strip():
            return jsonify({"error": "Name cannot be empty"}), 400
        product.name = data["name"].strip()

    if "description" in data:
        product.description = data["description"]

    if "price" in data:
        price = data["price"]
        if isinstance(price, bool) or not isinstance(price, (int, float)) or price < 0:
            return jsonify({"error": "Price must be a non-negative number"}), 400
        product.price = price

    if "stock_quantity" in data:
        stock = data["stock_quantity"]
        if isinstance(stock, bool) or not isinstance(stock, int) or stock < 0:
            return jsonify({"error": "Stock must be a non-negative integer"}), 400
        product.stock_quantity = stock

    if "is_active" in data:
        if not isinstance(data["is_active"], bool):
            return jsonify({"error": "is_active must be true or false"}), 400
        product.is_active = data["is_active"]

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Product update violates a database constraint"}), 409

    return jsonify({"message": "Product updated successfully"}), 200


@products_bp.delete("/<int:product_id>")
def delete_product(product_id):
    product = db.session.get(Product, product_id)

    if product is None:
        return jsonify({"error": "Product not found"}), 404

    if product.order_items:
        product.is_active = False
        db.session.commit()
        return jsonify({
            "message": "Product has order history, so it was deactivated instead of deleted"
        }), 200

    db.session.delete(product)
    db.session.commit()

    return jsonify({"message": "Product deleted successfully"}), 200
