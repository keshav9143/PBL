from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models import OSJob, Order, User

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")


def current_user():
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)
    except (TypeError, ValueError):
        user = None

    if user is None or not user.is_active:
        return None

    return user


def job_data(job):
    return {
        "id": job.id,
        "order_id": job.order_id,
        "process_id": job.process_id,
        "process_state": job.process_state,
        "scheduling_algorithm": job.scheduling_algorithm,
        "priority": job.priority,
        "burst_time": job.burst_time,
        "arrival_time": job.arrival_time,
        "waiting_time": job.waiting_time,
        "turnaround_time": job.turnaround_time,
        "response_time": job.response_time,
        "cpu_start_time": (
            job.cpu_start_time.isoformat() if job.cpu_start_time else None
        ),
        "cpu_finish_time": (
            job.cpu_finish_time.isoformat() if job.cpu_finish_time else None
        ),
        "error_message": job.error_message,
    }


@jobs_bp.get("/")
@jwt_required()
def list_jobs():
    user = current_user()

    if user is None:
        return jsonify({"error": "Account not found or inactive"}), 401

    jobs = (
        OSJob.query
        .join(Order, OSJob.order_id == Order.id)
        .filter(Order.user_id == user.id)
        .order_by(OSJob.id.asc())
        .all()
    )

    return jsonify({
        "count": len(jobs),
        "jobs": [job_data(job) for job in jobs],
    }), 200


@jobs_bp.get("/<int:job_id>")
@jwt_required()
def get_job(job_id):
    user = current_user()

    if user is None:
        return jsonify({"error": "Account not found or inactive"}), 401

    job = (
        OSJob.query
        .join(Order, OSJob.order_id == Order.id)
        .filter(OSJob.id == job_id, Order.user_id == user.id)
        .first()
    )

    if job is None:
        return jsonify({"error": "OS job not found"}), 404

    return jsonify(job_data(job)), 200
