export default function ExtractPage() {
  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Analizator">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            📊
          </div>
          <div>
            <h1>📊 Analizator</h1>
            <p className="agent-description">
              Moduł analizy danych z kursu. Do analizy obrazów użyj zakładki Vision.
            </p>
          </div>
        </header>
      </section>
    </main>
  );
}
