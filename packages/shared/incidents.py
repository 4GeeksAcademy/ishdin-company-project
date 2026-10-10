from enum import Enum


class IncidentCategory(str, Enum):
    LOST_PARCEL = "lost_parcel"
    DELIVERY_FAILURE = "delivery_failure"
    INVENTORY_DISCREPANCY = "inventory_discrepancy"
    CARRIER_ISSUE = "carrier_issue"
    RETURNS_ISSUE = "returns_issue"
    WAREHOUSE_INCIDENT = "warehouse_incident"
    SYSTEM_FAILURE = "system_failure"
    CLIENT_COMPLAINT = "client_complaint"
    OTHER = "other"


class IncidentStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISCARDED = "discarded"


class IncidentOrigin(str, Enum):
    CUSTOMER = "customer"
    BRANCH = "branch"
    INTERNAL = "internal"


class IncidentBranch(str, Enum):
    CENTRAL = "central"
    LA_WAREHOUSE = "la_warehouse"
    LA_OFFICE = "la_office"
    ZARAGOZA_WAREHOUSE = "zaragoza_warehouse"
    ZARAGOZA_OFFICE = "zaragoza_office"


BRANCH_LABELS = {
    IncidentBranch.CENTRAL: "Central",
    IncidentBranch.LA_WAREHOUSE: "Los Angeles — Warehouse",
    IncidentBranch.LA_OFFICE: "Los Angeles — Office",
    IncidentBranch.ZARAGOZA_WAREHOUSE: "Zaragoza — Warehouse",
    IncidentBranch.ZARAGOZA_OFFICE: "Zaragoza — Office",
}


ALLOWED_STATUS_TRANSITIONS = {
    IncidentStatus.OPEN: {
        IncidentStatus.IN_PROGRESS,
        IncidentStatus.DISCARDED,
    },
    IncidentStatus.IN_PROGRESS: {
        IncidentStatus.RESOLVED,
        IncidentStatus.DISCARDED,
    },
    IncidentStatus.RESOLVED: set(),
    IncidentStatus.DISCARDED: set(),
}


def is_valid_status_transition(
    current_status: IncidentStatus,
    new_status: IncidentStatus,
) -> bool:
    return new_status in ALLOWED_STATUS_TRANSITIONS[current_status]
