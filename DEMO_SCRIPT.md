# CASCADE demo video script

**Target length:** 2 minutes 40 seconds
**Scenario:** Fresh isolated demo state; fictional two-calendar-day cabinet-grade plywood delay; Palmer is the hard-deadline target.
**Safety:** All data and costs are simulated. Do not record database URLs, secrets, bearer tokens, password entry, or real customer/supplier information.

## Pre-recording checks

- Use a fresh, isolated demo database/state. The API does not refresh an existing `northstar-demo` row; do not reset production or overwrite a scenario with an audit history.
- Sign in before recording, confirm the dashboard shows the expected current planning week, and verify there is no active disruption or prior recovery plan.
- Confirm the material control is set to **Cabinet-grade plywood**, the delay to **2 days**, and the target order to **Palmer**.
- Confirm displayed figures against the isolated scenario before recording. For a fresh scenario generated on October 22, 2026: arrival moves from October 21 to October 23 (Friday); plans are $520 / 8 on time / 0 late (expedite), $310 / 6 on time / 2 late (partial buy), and $300 / 5 on time / 3 late (wait, infeasible for Palmer). The seed is date-relative, so use the actual dates shown when recording.
- Frame the recording around the dashboard only. No Alexa+ connection is demonstrated; do not describe browser speech input as Alexa+.

## Timed screen sequence

| Time | Screen/action | Presenter narration and proof points |
| --- | --- | --- |
| 0:00–0:18 | **Workshop overview**: show the fictional-data badge, scenario name, order summary, nearest deadline, materials, and empty disruption state. | “CASCADE is a deterministic shopfloor recovery simulator. The people, suppliers, orders, and costs are fictional; no supplier is contacted.” |
| 0:18–0:38 | **Disruption intake**: select cabinet-grade plywood and a two-day delay, then choose **Simulate disruption**. | “We model a two-day delay against shared plywood inventory. The note is descriptive; these controls define the simulated input.” |
| 0:38–0:58 | **Impact & dependencies**: show original and revised arrival, exposed-order/task counts, dependency graph, and highlighted affected orders. | “The engine traces the material shortage through dependent tasks into exposed customer orders. These are simulated inputs, not a live supplier event.” |
| 0:58–1:22 | **Recovery comparison**: select Palmer as target and choose **Compare**. Show all three plan cards, costs, on-time/late counts, recommendation marker, and infeasible wait option. | “Palmer’s deadline is hard. Other due dates are explicit trade-offs. These modeled estimates show expedite costs more but keeps all eight on time; the partial buy costs less but leaves two late; waiting is cheaper but misses Palmer’s deadline.” |
| 1:22–1:42 | **Recommended plan detail**: show rationale, modeled cost components, schedule actions, and constraint policy. Select the feasible recommended expedite plan if it is not already selected. | “The policy minimizes late customers first, then modeled cost. The recommendation follows from the displayed trade-offs and schedule constraints.” |
| 1:42–1:58 | **Approval**: choose **Explicitly approve plan** and show approved status. | “Approval is a separate human decision; it does not execute the plan.” |
| 1:58–2:18 | **Execution confirmation**: choose **Review execution**, show the simulation-only warning, check the acknowledgment, and confirm execution. | “Execution requires a second confirmation and changes only the fictional persisted scenario. It does not contact suppliers or customers.” |
| 2:18–2:34 | **Verification result**: choose **Verify simulated outcome**. Show verification status, state match, and on-time/late counts. | “Verification checks the resulting state against the plan projection. If the isolated run matches the expected result, show verified, state match yes, eight on time, zero late.” |
| 2:34–2:40 | **Action history**: open the history drawer and briefly show disruption, proposal, approval, execution, and verification events. | “The simulated decision path is auditable. This is an MCP-enabled demo, not a completed Alexa+ integration.” |

## Submission assets and access checklist

- [ ] Record and review the final video; keep it under three minutes and remove accidental secret exposure.
- [ ] Capture any requested screenshots from a fresh isolated scenario; none are currently checked into the repository.
- [ ] Create an architecture diagram only if useful or required; none is currently checked in.
- [ ] Confirm the submission portal’s current format, size, deadline, fields, and project-link requirements; no submission URL or registration status is confirmed here.
- [ ] Confirm hackathon/Alexa+ eligibility and any required Alexa+ access, accounts, devices, or review permissions through the official submission process; this repository does not establish them.
- [ ] Provide reviewer access through the approved private credential-sharing channel; do not put passwords or MCP bearer credentials in source, screenshots, or video.
- [ ] Before a deployed demo, confirm health/readiness, sign-in, current scenario dates, and MCP bearer access without mutating production data. If deployed data is stale, request a separately approved non-production refresh plan or use a fresh isolated demo environment.
