from decimal import Decimal
from uuid import uuid4

from app import db
from app.models import Order, OrderItem, Product, OSJob, User


def create_order(user_id, items):
    if not isinstance(items, list) or not items:
        raise ValueError("Order must contain at least one item")

    if db.session.get(User, user_id) is None:
        raise ValueError("User does not exist")

    quantities = {}

    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Each item must be an object")

        product_id = item.get("product_id")
        quantity = item.get("quantity")

        if isinstance(product_id, bool) or not isinstance(product_id, int) or product_id <= 0:
            raise ValueError("Invalid product ID")

        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
            raise ValueError("Quantity must be a positive integer")

        quantities[product_id] = quantities.get(product_id, 0) + quantity

    try:
        product_ids = sorted(quantities.keys())

        products = (
            Product.query
            .filter(Product.id.in_(product_ids))
            .order_by(Product.id)
            .with_for_update()
            .all()
        )

        product_map = {product.id: product for product in products}

        if len(product_map) != len(product_ids):
            raise ValueError("One or more products do not exist")

        total = Decimal("0.00")

        for product_id, quantity in quantities.items():
            product = product_map[product_id]

            if not product.is_active:
                raise ValueError(f"Product {product.name} is inactive")

            if product.stock_quantity < quantity:
                raise ValueError(f"Insufficient stock for {product.name}")

            total += Decimal(str(product.price)) * quantity

        order = Order(
            order_number=f"ORD-{uuid4().hex[:12].upper()}",
            user_id=user_id,
            status="pending",
            total_amount=total,
        )

        db.session.add(order)
        db.session.flush()

        for product_id, quantity in quantities.items():
            product = product_map[product_id]

            db.session.add(OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=product.price,
            ))

            product.stock_quantity -= quantity

        job = OSJob(
            order_id=order.id,
            process_id=f"PID-{uuid4().hex[:12].upper()}",
            process_state="READY",
            scheduling_algorithm="FCFS",
            priority=1,
            burst_time=5,
        )

        db.session.add(job)
        db.session.commit()

        return order

    except Exception:
        db.session.rollback()
        raise
