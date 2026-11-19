# Claude Code handoff for the AvaGuard pitch deck

Work from the AvaGuard repository root. Create the final **five-slide, Vietnamese, 16:9 pitch deck** for the Vietnam UniHack 2026 judges. Save the editable PowerPoint as `deliverables/AvaGuard-UniHack-2026-VI.pptx`. Slide 1 is the cover and introduction. Export and inspect the PowerPoint before handing it back. Write short speaker notes in Vietnamese for each slide. Reply to the user in Vietnamese.

## Read the project sources first

- `AGENTS.md`, `docs/DECISIONS.md`, and `docs/SCANNER_SPEC.md` define the scope, scoring, coverage, and trust boundaries.
- `docs/DEMO_SCRIPT.md` contains the planned order and five-slide outline. `docs/DEMO_VOICEOVER.md` contains the narration cues and distinguishes the fresh scan from the previously published G5 report.
- `README.md` and `docs/releases/m7-fuji/README.md` contain the judge walkthrough and links to the original reports, receipts, and verified contract sources.
- `docs/releases/m7-fuji/g5-acceptance-2026-11-18.json` is the source for recorded scores, coverage counts, imports, and replays. Follow its references for the Mint/pause JSON, publication, and replay evidence. Use `docs/releases/m7-fuji/g3-verification-2026-11-17.json` for the Builder Hub source verification result.

Use the manifests for observed results and the demo scripts for the presentation order. Use short Vietnamese text on slides and keep English product labels where judges need to find them in the UI. In the speaker notes, name the source for each factual slide and include public evidence links where available.

## Slide 1 — AvaGuard và điểm tín hiệu có thể kiểm chứng

Introduce AvaGuard as a tool that scans ERC-20 contracts on Avalanche Fuji. Start with the judge's question about which evidence produced a given score. Show that each scored report links the score, evidence, and coverage to a specific block. Use one real Scan screenshot with those fields visible if available. A clean title composition with the single product statement also works.

## Slide 2 — Từ block Fuji đến báo cáo có thể kiểm chứng

Build an editable diagram. Start with one scan of an ERC-20 contract at an explicit block on Fuji C-Chain (`43113`). Show the block number and block hash. Split the report into two paths. The canonical JSON keeps the detailed report off-chain. An authorized attester signs through MetaMask and `RiskRegistry` records the report hash plus summary fields on Fuji. Bring both paths into `Lookup` and show the two checks in order. Import checks the file against the registry record. `Replay original block` runs the scan at the report's original block and compares the resulting report hash.

## Slide 3 — Kết quả bốn mẫu trên Fuji

Make an editable table. Keep the same order as the video so this slide also works as a full-screen frame in the demo.

| Mẫu | Điểm / 100 | Block snapshot | Đã kiểm tra / Ngoài phạm vi | Tín hiệu chính |
| --- | ---: | ---: | ---: | --- |
| Baseline | 0 | 61245287 | 11 / 6 | 0 tín hiệu có trọng số |
| Mint/pause | 45 | 61246821 | 12 / 7 | Dấu hiệu mint và pause từ bytecode, code của owner là `0x` |
| Proxy | 60 | 61260485 | 14 / 6 | Proxy ERC-1967, dấu hiệu mint, code của owner là `0x` |
| Decoy | 0 | 61260797 | 11 / 6 | Mẫu đối chứng cho tín hiệu mint, 0 tín hiệu có trọng số |

Verify the table against the G5 manifest. All four reports recorded zero unavailable coverage items. Explain that the signal score summarizes the checks in scope. Use the notes to explain how the bytecode match indicates a possible capability and that authority to call it is outside the checks. Keep the table readable at video size.

## Slide 4 — Bốn giao dịch, bốn báo cáo replay khớp

Show the observed G5 results on localhost connected to live Avalanche Fuji. Four attester transactions succeeded. Four original files matched their registry commitments in a fresh browser session. Browser evidence records four matching original-block replays, with Mint/pause independently replayed as a representative check. If available, show a real screenshot of the Mint/pause lookup at block `61246821` with `Commitment matches` and `replay-matches`. Otherwise use those recorded status labels as text alongside the G5 reference.

Explain in the notes that a matching commitment ties the file to what an authorized attester published. Replay uses the recorded snapshot and depends on historical state being available. In this demo the explanation is labeled `Template explanation`. Describe the analyzer as a source of evidence and risk signals within its stated coverage. Builder Hub source verification applies to the six deployed demo contracts and is a separate check.

## Slide 5 — Tự kiểm chứng từ GitHub

Give judges one concrete path. Open the AvaGuard README, download the original Mint/pause JSON, follow the Fuji startup steps, then select snapshot `61246821` in `Lookup`, import the file, and run `Replay original block`. Mention the recorded receipt at block `61247120` in the notes so the speaker can distinguish it from the scan snapshot. Add readable, clickable links to the [GitHub evidence and JSON table](https://github.com/ChieNg00/AvaGuard#review-the-fuji-evidence) and the verified [RiskRegistry source on Builder Hub](https://build.avax.network/explorer/fuji/c-chain/address/0x003D1f3C26FfAC734297979B1FC82914217C5392). Use a public video or live app link only when its real URL and reviewer access can be confirmed.

## Build and verify the file

1. Use an available local PPTX authoring tool. Start with the existing app palette of charcoal `#101B22`, light text `#EDF1ED`, and soft green `#BDECC6`. Use a Vietnamese-capable font, strong contrast, and generous margins. Aim for 32 pt or larger titles and 18 pt or larger body text. Keep the titles, table, and process diagram editable.
2. Use existing real screenshots or a frame from the user's demo when available. A read-only screenshot of a running Fuji app is also suitable. Check that the chain, block, and result match the accompanying claim. Label evidence from the fresh scan and the earlier G5 publication by its actual snapshot. Crop browser chrome and account details unrelated to the evidence. Use native text and diagrams when screenshots are unavailable.
3. Export the PPTX. Render each slide with an available viewer or renderer and fix any clipping, overlap, broken Vietnamese diacritics, low contrast, or text that is too small to present. Confirm the file contains five slides, all speaker notes, and the intended clickable links. Check public links without signing in if the environment permits. If local rendering is unavailable, inspect the exported file structure and report the remaining visual check.
4. Keep authoring local and changes limited to the deck and any required progress entry. Use `cache/` for any scratch files. Preserve the app, package lockfile, and canonical reports. Work in this session and keep external actions outside the local slide task.
5. Return the absolute path to the finished PPTX with a brief summary of the slide checks you actually performed.
