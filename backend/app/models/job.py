from datetime import datetime, timezone

from app import db


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class OSJob(db.Model):
    __tablename__ = "os_jobs"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(
        db.Integer, db.ForeignKey("orders.id"), unique=True, nullable=False
    )

    # Process Control Block (PCB) fields
    process_id = db.Column(db.String(40), unique=True, nullable=False, index=True)
    process_state = db.Column(
        db.String(20), nullable=False, default="NEW", index=True
    )
    scheduling_algorithm = db.Column(
        db.String(30), nullable=False, default="FCFS"
    )
    priority = db.Column(db.Integer, nullable=False, default=5)
    burst_time = db.Column(db.Integer, nullable=False, default=1)
    arrival_time = db.Column(db.Integer, nullable=False, default=0)
    waiting_time = db.Column(db.Integer, nullable=False, default=0)
    turnaround_time = db.Column(db.Integer, nullable=False, default=0)
    response_time = db.Column(db.Integer, nullable=True)
    cpu_start_time = db.Column(db.DateTime, nullable=True)
    cpu_finish_time = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=utc_now, onupdate=utc_now
    )
    error_message = db.Column(db.Text, nullable=True)

    order = db.relationship("Order", back_populates="job")

    __table_args__ = (
        db.CheckConstraint("priority >= 0", name="ck_os_jobs_priority_nonnegative"),
        db.CheckConstraint("burst_time > 0", name="ck_os_jobs_burst_positive"),
        db.CheckConstraint("waiting_time >= 0", name="ck_os_jobs_wait_nonnegative"),
        db.CheckConstraint(
            "turnaround_time >= 0", name="ck_os_jobs_turnaround_nonnegative"
        ),
    )
