"""Scaffold for the scheduled TicketRush maintenance worker."""


def run_jobs(conn):
    raise NotImplementedError("Implement the scheduled database maintenance jobs")


def handler(event, context):
    raise NotImplementedError("Implement the EventBridge maintenance handler")
