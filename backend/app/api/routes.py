from app.api.products import products_bp
from app.api.orders import orders_bp
from app.api.jobs import jobs_bp
from app.api.scheduler import scheduler_bp


def register_routes(app):
    app.register_blueprint(products_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(scheduler_bp)
