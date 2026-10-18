from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import select

from app import db
from app.models import Order, OrderItem, User
from app.services.order_service import create_order

orders_bp = Blueprint("orders", __name__, url_prefix="/api/orders")


def authenticated_user():
    user_id = get_jwt_identity()

    try:
        user = db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        user = None

    if user is None or not user.is_active:
        return None

    return user


@orders_bp.post("/")
@jwt_required()
def place_order():
    user = authenticated_user()

    if user is None:
        return jsonify({"error": "Account not found or inactive"}), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    # Never trust a user_id supplied by the frontend.
    items = data.get("items")

    try:
        order = create_order(user.id, items)

        return jsonify({
            "message": "Order placed successfully",
            "order": {
                "id": order.id,
                "user_id": order.user_id,
                "status": order.status,
                "total_amount": float(order.total_amount),
            },
        }), 201

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Order creation failed")
        return jsonify({
            "error": "Unable to create order. Check Flask terminal."
        }), 500


@orders_bp.get("/")
@jwt_required()
def list_orders():
    user = authenticated_user()

    if user is None:
        return jsonify({"error": "Account not found or inactive"}), 401

    orders = db.session.execute(
        select(Order)
        .where(Order.user_id == user.id)
        .order_by(Order.id.desc())
    ).scalars().all()

    return jsonify({
        "count": len(orders),
        "orders": [
            {
                "id": order.id,
                "user_id": order.user_id,
                "status": order.status,
                "total_amount": float(order.total_amount),
            }
            for order in orders
        ],
    }), 200


@orders_bp.get("/<int:order_id>")
@jwt_required()
def get_order(order_id):
    user = authenticated_user()

    if user is None:
        return jsonify({"error": "Account not found or inactive"}), 401

    order = db.session.get(Order, order_id)

    # Return the same response for missing and another customer's orders.
    if order is None or order.user_id != user.id:
        return jsonify({"error": "Order not found"}), 404

    items = OrderItem.query.filter_by(order_id=order.id).all()

    return jsonify({
        "id": order.id,
        "user_id": order.user_id,
        "status": order.status,
        "total_amount": float(order.total_amount),
        "items": [
            {
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
            }
            for item in items
        ],
    }), 200
