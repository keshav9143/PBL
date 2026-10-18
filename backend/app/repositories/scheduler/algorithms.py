from collections import deque


def _prepare(processes):
    result = []

    for process in processes:
        item = dict(process)
        item["arrival_time"] = int(item.get("arrival_time", 0))
        item["burst_time"] = int(item["burst_time"])
        item["priority"] = int(item.get("priority", 5))

        if item["arrival_time"] < 0 or item["burst_time"] <= 0:
            raise ValueError(
                "Arrival time must be non-negative and burst time positive"
            )

        result.append(item)

    return result


def _summary(algorithm, results, timeline):
    count = len(results)

    return {
        "algorithm": algorithm,
        "processes": results,
        "timeline": timeline,
        "average_waiting_time": round(
            sum(p["waiting_time"] for p in results) / count, 2
        ) if count else 0,
        "average_turnaround_time": round(
            sum(p["turnaround_time"] for p in results) / count, 2
        ) if count else 0,
        "average_response_time": round(
            sum(p["response_time"] for p in results) / count, 2
        ) if count else 0,
    }


def _schedule_non_preemptive(processes, algorithm):
    pending = _prepare(processes)
    results = []
    timeline = []
    time = 0

    while pending:
        ready = [p for p in pending if p["arrival_time"] <= time]

        if not ready:
            next_arrival = min(p["arrival_time"] for p in pending)

            if next_arrival > time:
                timeline.append({
                    "process_id": "IDLE",
                    "start_time": time,
                    "finish_time": next_arrival,
                    "duration": next_arrival - time,
                })

            time = next_arrival
            continue

        if algorithm == "FCFS":
            current = min(
                ready, key=lambda p: (p["arrival_time"], p.get("id", 0))
            )
        elif algorithm == "SJF":
            current = min(
                ready,
                key=lambda p: (
                    p["burst_time"], p["arrival_time"], p.get("id", 0)
                ),
            )
        else:
            current = min(
                ready,
                key=lambda p: (
                    p["priority"], p["arrival_time"], p.get("id", 0)
                ),
            )

        pending.remove(current)

        start = time
        finish = start + current["burst_time"]
        waiting = start - current["arrival_time"]
        turnaround = finish - current["arrival_time"]

        results.append({
            **current,
            "start_time": start,
            "completion_time": finish,
            "waiting_time": waiting,
            "turnaround_time": turnaround,
            "response_time": waiting,
        })

        timeline.append({
            "process_id": current.get("process_id", str(current.get("id", "P"))),
            "start_time": start,
            "finish_time": finish,
            "duration": finish - start,
        })

        time = finish

    return _summary(algorithm, results, timeline)


def schedule_fcfs(processes):
    return _schedule_non_preemptive(processes, "FCFS")


def schedule_sjf(processes):
    return _schedule_non_preemptive(processes, "SJF")


def schedule_priority(processes):
    return _schedule_non_preemptive(processes, "PRIORITY")


def schedule_round_robin(processes, quantum=2):
    if (
        isinstance(quantum, bool)
        or not isinstance(quantum, int)
        or quantum <= 0
    ):
        raise ValueError("Time quantum must be a positive integer")

    pending = _prepare(processes)
    pending.sort(key=lambda p: (p["arrival_time"], p.get("id", 0)))

    ready = deque()
    timeline = []
    index = 0
    time = 0
    results = []

    for process in pending:
        process["remaining_time"] = process["burst_time"]
        process["first_start"] = None
        process["completion_time"] = None

    while index < len(pending) or ready:
        if not ready and index < len(pending):
            next_arrival = pending[index]["arrival_time"]

            if next_arrival > time:
                timeline.append({
                    "process_id": "IDLE",
                    "start_time": time,
                    "finish_time": next_arrival,
                    "duration": next_arrival - time,
                })

            time = max(time, next_arrival)

        while index < len(pending) and pending[index]["arrival_time"] <= time:
            ready.append(pending[index])
            index += 1

        if not ready:
            continue

        current = ready.popleft()

        if current["first_start"] is None:
            current["first_start"] = time

        start = time
        run_time = min(quantum, current["remaining_time"])
        time += run_time
        current["remaining_time"] -= run_time

        timeline.append({
            "process_id": current.get(
                "process_id", str(current.get("id", "P"))
            ),
            "start_time": start,
            "finish_time": time,
            "duration": run_time,
        })

        while index < len(pending) and pending[index]["arrival_time"] <= time:
            ready.append(pending[index])
            index += 1

        if current["remaining_time"] > 0:
            ready.append(current)
        else:
            current["completion_time"] = time

    for process in pending:
        finish = process["completion_time"]
        turnaround = finish - process["arrival_time"]

        results.append({
            **{
                key: value
                for key, value in process.items()
                if key not in ("remaining_time", "first_start")
            },
            "start_time": process["first_start"],
            "completion_time": finish,
            "waiting_time": turnaround - process["burst_time"],
            "turnaround_time": turnaround,
            "response_time": (
                process["first_start"] - process["arrival_time"]
            ),
        })

    return _summary("ROUND_ROBIN", results, timeline)
