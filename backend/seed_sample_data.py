from app import create_app, db
from app.models import Order, OSJob

app = create_app()

# Different workloads for demonstrating scheduling algorithms.
BURST_TIMES = [8, 2, 6, 3, 1, 7, 4, 9, 2, 5]
ARRIVAL_TIMES = [0, 1, 2, 3, 4, 0, 2, 1, 5, 3]
PRIORITIES = [3, 1, 4, 2, 5, 2, 1, 4, 3, 5]

with app.app_context():
    sample_orders = (
        Order.query
        .filter(Order.order_number.like("ORD-SEED-%"))
        .order_by(Order.order_number)
        .all()
    )

    if not sample_orders:
        print("No sample orders found. No changes made.")
    else:
        updated = 0
        missing_jobs = 0

        try:
            for index, order in enumerate(sample_orders):
                job = OSJob.query.filter_by(order_id=order.id).first()

                if job is None:
                    missing_jobs += 1
                    print(f"No OS job for {order.order_number}")
                    continue

                pattern_index = index % len(BURST_TIMES)

                job.arrival_time = ARRIVAL_TIMES[pattern_index]
                job.burst_time = BURST_TIMES[pattern_index]
                job.priority = PRIORITIES[pattern_index]

                # Preserve the current process state.
                updated += 1

            db.session.commit()

        except Exception:
            db.session.rollback()
            raise

        print("\nSample-job update complete.")
        print(f"Sample orders found: {len(sample_orders)}")
        print(f"OS jobs updated: {updated}")
        print(f"Orders missing OS jobs: {missing_jobs}")
        print("Product stock was not changed.")
        print("Customer and order records were preserved.")
        print("Existing process states were preserved.")
