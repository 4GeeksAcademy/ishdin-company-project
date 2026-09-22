from io import TextIOWrapper
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import Response

from app.models.incidents import IncidentAnalysisResult
from app.services.incident_analyzer import (
    IncidentFileError,
    analyze_csv_stream,
    build_results_csv,
)
from app.services.result_store import (
    get_latest_result,
    save_latest_result,
)


router = APIRouter()


@router.post(
    "/analyze",
    response_model=IncidentAnalysisResult,
    status_code=status.HTTP_200_OK,
    summary="Analyze a TrackFlow incident CSV",
)
def analyze_incidents(
    file: UploadFile = File(...),
) -> IncidentAnalysisResult:
    """
    Accept a CSV as multipart/form-data, run the TrackFlow validation/analysis,
    save the latest result in memory, and return the summary as JSON.
    """
    filename = (file.filename or "").strip()

    if not filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A CSV file is required.",
        )

    if Path(filename).suffix.lower() != ".csv":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect file type. Please upload a .csv file.",
        )

    # UploadFile uses a spooled file, so checking its size this way does not
    # require loading a potentially large production CSV into application RAM.
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file could not be read.",
        ) from exc

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded CSV file is empty.",
        )

    text_stream = TextIOWrapper(
        file.file,
        encoding="utf-8-sig",
        newline="",
    )

    try:
        result = analyze_csv_stream(text_stream)

    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The CSV could not be decoded as UTF-8. "
                "Please upload a UTF-8 encoded CSV file."
            ),
        ) from exc

    except IncidentFileError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    finally:
        # Detach so TextIOWrapper does not close UploadFile's underlying file;
        # FastAPI owns that lifecycle.
        try:
            text_stream.detach()
        except ValueError:
            pass

    save_latest_result(result)
    return result


@router.get(
    "/results/export",
    summary="Download the most recent incident analysis as CSV",
)
def export_latest_results() -> Response:
    result = get_latest_result()

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No analysis is available yet. "
                "Upload and analyze a CSV file first."
            ),
        )

    csv_content = build_results_csv(result)

    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="results.csv"'
        },
    )
