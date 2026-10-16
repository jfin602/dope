# Current release decision extract

Source: `docs/planning-brief.md`, decision revision 4. This extract is a concise presentation of the governing revision, not a new owner revision.

Revision 4 supersedes the provisional revision-2 go note. Key Rotation is **NOT GREEN** because credential rollover verification failed. Integration Gate depends on Key Rotation. Release Candidate depends on Integration Gate. Do not start the release canary. Repair Key Rotation, obtain a Green verification record, then reassess Integration Gate and Release Candidate.
