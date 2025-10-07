function DownloadPanel({
  lessonDataLoading,
  canDownloadWorksheet,
  canDownloadTest,
  onDownloadWorksheet,
  onDownloadTest,
  onReroll,
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        alignItems: 'stretch',
        marginTop: 8,
        marginBottom: 4,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        paddingLeft: 12,
        paddingRight: 12,
      }}
    >
      <button
        type="button"
        style={{
          background: lessonDataLoading || !canDownloadWorksheet ? "#6b7280" : "#1f2937",
          color: "#fff",
          borderRadius: 8,
          padding: '12px 14px',
          minHeight: 44,
          fontWeight: 600,
          border: "none",
          cursor: lessonDataLoading || !canDownloadWorksheet ? "not-allowed" : "pointer",
          opacity: lessonDataLoading || !canDownloadWorksheet ? 0.7 : 1,
          width: '100%',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}
        disabled={lessonDataLoading || !canDownloadWorksheet}
        onClick={onDownloadWorksheet}
      >
        Worksheet
      </button>
      <button
        type="button"
        style={{
          background: lessonDataLoading || !canDownloadTest ? "#6b7280" : "#1f2937",
          color: "#fff",
          borderRadius: 8,
          padding: '12px 14px',
          minHeight: 44,
          fontWeight: 600,
          border: "none",
          cursor: lessonDataLoading || !canDownloadTest ? "not-allowed" : "pointer",
          opacity: lessonDataLoading || !canDownloadTest ? 0.7 : 1,
          width: '100%',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}
        disabled={lessonDataLoading || !canDownloadTest}
        onClick={onDownloadTest}
      >
        Test
      </button>
      <button
        type="button"
        style={{
          background: lessonDataLoading || (!canDownloadWorksheet && !canDownloadTest) ? "#6b7280" : "#c7442e",
          color: "#fff",
          borderRadius: 8,
          padding: '12px 14px',
          minHeight: 44,
          fontWeight: 700,
          border: "none",
          cursor: lessonDataLoading || (!canDownloadWorksheet && !canDownloadTest) ? "not-allowed" : "pointer",
          opacity: lessonDataLoading || (!canDownloadWorksheet && !canDownloadTest) ? 0.7 : 1,
          width: '100%',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}
        disabled={lessonDataLoading || (!canDownloadWorksheet && !canDownloadTest)}
        onClick={onReroll}
        title="Reset and re-generate a new worksheet and test"
      >
        Refresh Worksheet & Test
      </button>
    </div>
  );
}

export default DownloadPanel;
