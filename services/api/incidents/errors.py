import logging

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute


logger = logging.getLogger("trackflow.incidents")


def _friendly_message(error: dict) -> str:
    error_type = error.get("type", "")

    if error_type == "missing":
        return "This field is required."

    if error_type in {
        "string_too_short",
        "string_unicode",
    }:
        return "This field cannot be blank."

    if error_type == "string_too_long":
        return "This value is too long."

    if error_type == "enum":
        return "Choose one of the allowed values."

    if error_type in {
        "uuid_parsing",
        "uuid_type",
    }:
        return "Enter a valid incident ID."

    return "Enter a valid value."


def validation_error_response(
    exc: RequestValidationError,
) -> JSONResponse:
    fields: dict[str, str] = {}

    for error in exc.errors():
        location = [
            str(part)
            for part in error.get("loc", ())
            if part not in {"body", "query", "path"}
        ]

        field_name = ".".join(location) or "request"

        if field_name not in fields:
            fields[field_name] = _friendly_message(error)

    return JSONResponse(
        status_code=400,
        content={
            "error": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": fields,
        },
    )


class IncidentAPIRoute(APIRoute):
    """
    Keeps Incident Manager errors user-friendly without changing validation
    behavior for unrelated modules in the monorepo.
    """

    def get_route_handler(self):
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request):
            try:
                return await original_route_handler(request)

            except RequestValidationError as exc:
                return validation_error_response(exc)

            except HTTPException:
                raise

            except Exception:
                logger.exception(
                    "Unhandled exception in Incident Manager API."
                )

                return JSONResponse(
                    status_code=500,
                    content={
                        "error": "internal_server_error",
                        "message": (
                            "Something went wrong while processing your "
                            "request. Please try again."
                        ),
                    },
                )

        return custom_route_handler
