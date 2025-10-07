import { primaryButtonStyle } from "./styles.js";

function PhaseDetail({
  phase,
  subPhase,
  subPhaseStatus,
  onDiscussionAction,
  onTeachingAction,
  learnerInput,
  setLearnerInput,
  worksheetAnswers,
  setWorksheetAnswers,
  testAnswers,
  setTestAnswers,
  callMsSonoma,
  subjectParam,
  difficultyParam,
  lessonParam,
  setPhase,
  setSubPhase,
  ticker,
  setTicker,
  setCanSend,
  waitForBeat,
  transcript,
}) {
  const renderSection = () => {
    switch (phase) {
      case "discussion":
        // Controls and status for discussion are handled elsewhere; render nothing here.
        return null;
      case "teaching":
        // Controls and status for teaching are handled elsewhere; render nothing here.
        return null;
      case "comprehension":
        return (
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: 0 }}>Correct Answers: {ticker}</p>
            <p style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>
              Continue responding in the input; Ms. Sonoma will ask the next question automatically until the target is met.
            </p>
          </div>
        );
      case "worksheet":
        return (
          <div style={{ marginBottom: 24 }}>
            <p>Worksheet progress: {worksheetAnswers.length}</p>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={async () => {
                const nextTicker = ticker + 1;
                setTicker(nextTicker);
                setWorksheetAnswers([...worksheetAnswers, learnerInput]);
                const result = await callMsSonoma(
                  "Worksheet: Remind to print, give hints if incorrect, cue next phase at target count.",
                  learnerInput,
                    {
                    phase: "worksheet",
                    subject: subjectParam,
                    difficulty: difficultyParam,
                    lesson: lessonParam,
                  lessonTitle: effectiveLessonTitle,
                    ticker: nextTicker,
                  }
                );
                setLearnerInput("");
                if (result.success && nextTicker >= WORKSHEET_TARGET) {
                  setPhase("test");
                  setSubPhase("test-start");
                  setCanSend(false);
                }
              }}
            >
              Next worksheet item
            </button>
          </div>
        );
      case "test":
        // Render Review controls inline when in a review subphase to keep the timeline in Test
        if (typeof subPhase === 'string' && subPhase.startsWith('review')) {
          return (
            <div style={{ marginBottom: 24 }}>
              <h2>Facilitator Review</h2>
              <p>Adjust correctness as needed, then accept.</p>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                <span>
                  Score preview: {typeof testFinalPercent === 'number' ? testFinalPercent : Math.round(((Array.isArray(testCorrectByIndex)?testCorrectByIndex.filter(Boolean).length:0)/Math.max(1,(Array.isArray(generatedTest)?generatedTest.length:0))*100))}%
                </span>
                <button type="button" style={primaryButtonStyle} onClick={finalizeReview}>Accept</button>
              </div>
            </div>
          );
        }
        return (
          <div style={{ marginBottom: 24 }}>
            <p>Test answers recorded: {testAnswers.length}</p>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={async () => {
                const nextTicker = ticker + 1;
                setTicker(nextTicker);
                setTestAnswers([...testAnswers, learnerInput]);
                const payload = {
                  phase: "test",
                  subject: subjectParam,
                  difficulty: difficultyParam,
                  lesson: lessonParam,
                  lessonTitle: effectiveLessonTitle,
                  ticker: nextTicker,
                };
                // Clear input immediately
                setLearnerInput("");
                // If we've met or exceeded the target, do not await anything — go straight to review.
                if (nextTicker >= TEST_TARGET) {
                  try { setCanSend(false); } catch {}
                  // Review is a subphase of Test; keep phase pinned to 'test'
                  try { setSubPhase("review-start"); } catch {}
                  // Fire-and-forget the API call so logs/metrics are not lost, but do not block UI.
                  try { callMsSonoma("Test: Black screen, overlay questions, grade after all answers, no hints or rephrasing.", learnerInput, payload); } catch {}
                  return;
                }
                // Otherwise, continue normal flow for intermediate questions.
                try {
                  await callMsSonoma(
                    "Test: Black screen, overlay questions, grade after all answers, no hints or rephrasing.",
                    learnerInput,
                    payload
                  );
                } catch {}
              }}
            >
              Submit test answer
            </button>
          </div>
        );
      case "grading":
        return (
          <div style={{ marginBottom: 24 }}>
            <p>Grading in progress...</p>
          </div>
        );
      case "review":
        // Legacy: keep nothing here so timeline stays consistent; review renders under test phase
        return null;
      case "congrats":
        return (
          <div style={{ marginBottom: 24 }}>
            <h2>Congratulations!</h2>
            {!congratsStarted ? (
              <div>
                <p>{transcript}</p>
                <button type="button" style={primaryButtonStyle} onClick={() => setCongratsStarted(true)}>Start Congrats</button>
              </div>
            ) : (
              <p>{transcript}</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return renderSection();
}

export default PhaseDetail;
