from datetime import datetime, timezone

from app import db
from app.models import OSJob, Order
from app.repositories.scheduler.algorithms import (
    schedule_fcfs,
    schedule_sjf,
    schedule_priority,
    schedule_round_robin,
)


def run_scheduler(user_id, algorithm="FCFS", quantum=2):
    algorithm = algorithm.upper()

    # Only fetch READY jobs belonging to this customer's orders.
    jobs = (
        OSJob.query
        .join(Order, OSJob.order_id == Order.id)
        .filter(
            Order.user_id == user_id,
            OSJob.process_state == "READY",
        )
        .order_by(OSJob.arrival_time, OSJob.id)
        .all()
    )

    if not jobs:
        return {
            "message": "No READY jobs found for this account",
            "algorithm": algorithm,
            "count": 0,
            "processes": [],
        }

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

    if algorithm == "FCFS":
        result = schedule_fcfs(processes)
    elif algorithm == "SJF":
        result = schedule_sjf(processes)
    elif algorithm == "PRIORITY":
        result = schedule_priority(processes)
    elif algorithm in ("ROUND_ROBIN", "RR"):
        result = schedule_round_robin(processes, quantum)
    else:
        raise ValueError("Algorithm must be FCFS, SJF, PRIORITY, or ROUND_ROBIN")

    by_id = {job.id: job for job in jobs}
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    try:
        for process in result["processes"]:
            job = by_id[process["id"]]
            job.scheduling_algorithm = result["algorithm"]
            job.waiting_time = process["waiting_time"]
            job.turnaround_time = process["turnaround_time"]
            job.response_time = process["response_time"]
            job.cpu_start_time = now
            job.cpu_finish_time = now
            job.process_state = "COMPLETED"

        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return {
        "message": "Scheduling completed",
        "algorithm": result["algorithm"],
        "count": len(result["processes"]),
        "average_waiting_time": result["average_waiting_time"],
        "average_turnaround_time": result["average_turnaround_time"],
        "average_response_time": result["average_response_time"],
        "processes": result["processes"],
    }
