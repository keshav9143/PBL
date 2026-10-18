from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.models import OSJob, Order, User
from app.services.scheduler_service import run_scheduler
from app.repositories.scheduler.algorithms import (
    schedule_fcfs,
    schedule_sjf,
    schedule_priority,
    schedule_round_robin,
)

scheduler_bp = Blueprint("scheduler", __name__, url_prefix="/api/scheduler")


def current_user():
    try:
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)
    except (TypeError, ValueError):
        user = None

    if user is None or not user.is_active:
        return None

    return user


@scheduler_bp.post("/run")
@jwt_required()
def run():
    user = current_user()

    if user is None:
        return jsonify({"error": "Account not found or inactive"}), 401

    data = request.get_json(silent=True) or {}
    algorithm = data.get("algorithm", "FCFS")
    quantum = data.get("quantum", 2)

    if not isinstance(algorithm, str):
        return jsonify({"error": "Algorithm must be a string"}), 400

    if isinstance(quantum, bool) or not isinstance(quantum, int) or quantum <= 0:
        return jsonify({"error": "Quantum must be a positive integer"}), 400

    try:
        return jsonify(run_scheduler(user.id, algorithm, quantum)), 200
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        return jsonify({"error": "Scheduling failed; check Flask terminal"}), 500


@scheduler_bp.post("/demo")
@jwt_required()
def demo():
    user = current_user()

    if user is None:
        return jsonify({"error": "Account not found or inactive"}), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    processes = data.get("processes")
    quantum = data.get("quantum", 2)

    if not isinstance(processes, list) or not 1 <= len(processes) <= 20:
        return jsonify({"error": "Provide between 1 and 20 sample processes"}), 400

    if isinstance(quantum, bool) or not isinstance(quantum, int) or quantum <= 0:
        return jsonify({"error": "Quantum must be a positive integer"}), 400

    try:
        for index, process in enumerate(processes, start=1):
            if not isinstance(process, dict):
                return jsonify({"error": f"Process {index} must be an object"}), 400
            if "burst_time" not in process:
                return jsonify({"error": f"Process {index} needs a burst_time"}), 400

        comparisons = [
            schedule_fcfs(processes),
            schedule_sjf(processes),
            schedule_priority(processes),
            schedule_round_robin(processes, quantum=quantum),
        ]

        return jsonify({
            "message": "Demo simulation completed; database unchanged",
            "demo": True,
            "process_count": len(processes),
            "round_robin_quantum": quantum,
            "comparisons": comparisons,
        }), 200

    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400


@scheduler_bp.get("/compare")
@jwt_required()
def compare():
    user = current_user()

    if user is None:
        return jsonify({"error": "Account not found or inactive"}), 401

    jobs = (
        OSJob.query
        .join(Order, OSJob.order_id == Order.id)
        .filter(
            Order.user_id == user.id,
            OSJob.process_state.in_(["READY", "COMPLETED"]),
        )
        .order_by(OSJob.arrival_time, OSJob.id)
        .all()
    )

    if not jobs:
        return jsonify({
            "message": "No READY or COMPLETED jobs available for comparison",
            "source": "real_database",
            "process_count": 0,
            "round_robin_quantum": 2,
            "comparisons": [],
        }), 200

    processes = [
        {
            "id": job.id,
            "process_id": job.process_id,
            "arrival_time": job.arrival_time,
            "burst_time": job.burst_time,
            "priority": job.priority,
        }
        for job in jobs
    ]

    try:
        comparisons = [
            schedule_fcfs(processes),
            schedule_sjf(processes),
            schedule_priority(processes),
            schedule_round_robin(processes, quantum=2),
        ]

        return jsonify({
            "message": "Your database jobs compared; database unchanged",
            "source": "real_database",
            "process_count": len(processes),
            "round_robin_quantum": 2,
            "comparisons": comparisons,
        }), 200

    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400
