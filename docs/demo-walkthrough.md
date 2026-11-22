# A five-minute review

1. Run `npm run dev` and open http://localhost:3000/demo. The page says Sample data. Browser changes are isolated from real records.
2. Review the 84-hour approved baseline. With the seeded availability, its forecast finishes on 10 December 2026; the target is 11 December. Internal estimated labor is INR 137,200; budget is INR 240,000.
3. Open Change requests and analyze Add Hindi support. Inspect the reason, assumptions, scope edits and bilingual acceptance criteria.
4. Under trade-offs, leave Go-live preparation deferred for B. Set Nora to 8 hours/day from 23 November, with 6 hours onboarding, for C. Calculate and compare. A finishes 16 December; B finishes 14 December and explicitly omits go-live preparation; C finishes 15 December and costs more. All miss the requested date. More people is not a guaranteed deadline fix.
5. Select A and submit a proposal. Open Approvals, read the exact scope and add a note such as “Extended delivery date accepted; bilingual review required.” Approve revision 1.
6. Apply the approved change as delivery lead. Decision history shows baseline revision 2 and preserves revision 1. Reapplication is forbidden; stale estimates for other changes need recalculation.
7. Preview as client to review the simplified view. This is a synthetic role simulation only, not a separate user account. In real mode the server/DB return redacted records and enforce permissions.
8. Reset demo to repeat. Another tab with a stale version cannot silently overwrite newer demo records.

For a blank baseline journey, the automated workflow test starts with no approved baseline and traverses approval/application. In persistent mode, create a workspace/project and approve its editable starter scope first.
