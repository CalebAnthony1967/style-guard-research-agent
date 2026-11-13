# Revised Implementation Plan - Database-Backed Dynamic Publications Control Form Workflow (KIPPRA/QMS/RPC/2023/03)

## Objective
Implement a database-backed workflow where the Publications Control Form (KIPPRA/QMS/RPC/2023/03) routes dynamically across role-specific portals. Each reviewer portal displays only its relevant section of the form with exact compliance fields, supported by a Reviewer Assistant that ties document inspection and compliance checks directly to sign-off actions.

## Role-Specific Portals & Exact Form Fields
1. **Researcher / Lead Author Portal**:
   - Fields: Tentative Title of Publication, Publication Series, Author(s) full names, Originating Department and Directorate.
   - Action: Submit Concept Paper / Draft Paper for HOD review.
2. **Head of Department (HOD) Portal**:
   - Fields: Presentation of Concept Paper at Department Level (Date of presentation, HOD digital signature), Presentation of Draft Paper at Department Level (Date of presentation, HOD digital signature).
   - Action: Review manuscript via Reviewer Assistant, sign digitally, add comments, route to Director.
3. **Director Portal**:
   - Fields: Review of the Draft Paper by the Director (Date received from HOD, Date of completion of review by Director, HOD signature, Director signature), Presentation of Draft Paper at Weekly Internal Seminar - WIS (Date of presentation, Director signature).
   - Action: Review WIS feedback and compliance scorecard, sign digitally, add comments, route to Executive Director.
4. **Executive Director Portal**:
   - Fields: Recommendations and Decisions of the Seminar Panel ((a) Submit for Publication; (b) Revise and Submit; (c) Revise and Present Again), Decision received by Director and communicated, Authorization for Publication by Executive Director (Date of Authorization, Signature of Executive Director).
   - Action: Review aggregated Control Form with all prior sign-offs, authorize publication.
5. **Knowledge Management & Editorial Portal**:
   - Fields: Received for Publication by Deputy Director Knowledge Management (Date of receipt, Signature of Deputy Director), Editorial and Production tracking (First editing and typesetting, Second editing and compilation, Comments sent to author, Final corrections, Requisition for printing with specifications).
   - Action: Assign editorial team, track publication production.
