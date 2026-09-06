# CONTEXT

## People & Talent recruitment campaign

The People & Talent department is actively recruiting for an open position and has received more than 100 applications in under two weeks. Candidate information is currently split across a shared spreadsheet, separate interview-note documents, and status updates sent through email threads.

The Technology team has exposed a REST API for the recruitment pipeline. This frontend is an internal People & Talent tool that sits in `/uis/talent-pipeline-tracker` and gives the recruiting team one place to review candidates, search and filter the pipeline, update status and stage, maintain internal notes, register applicants, and correct candidate information.

## UI framing

The interface should feel like an internal People & Talent workspace, not a generic CRUD demo. Visible terminology should use recruitment language such as:

- People & Talent
- Talent Pipeline
- Candidates
- Application stage
- Candidate status
- Internal notes
- Recruitment campaign

The backend API field names remain unchanged even when the UI uses clearer recruiting labels.
